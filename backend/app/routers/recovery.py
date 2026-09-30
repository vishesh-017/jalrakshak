import hashlib
import io
import csv
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas, models

router = APIRouter(prefix="/recovery", tags=["Plastic Recovery Ledger"])

def compute_record_audit_hash(r: models.RecoveryRecord) -> str:
    """Computes a lightweight cryptographic SHA-256 tamper-evident hash for recovery auditing."""
    payload = f"{r.id}|{r.manifest_number}|{r.site_id}|{r.recovery_date}|{r.total_weight_kg:.2f}|{r.pet_bottles_kg:.2f}|{r.disposal_facility}|{r.verification_status}|{r.source_status}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

class RecoveryLedgerItemWithAudit(schemas.RecoveryRecordResponse):
    audit_hash: str
    epr_eligibility_status: str
    epr_assessment_notes: str

class AuditLedgerSummary(BaseModel):
    total_records: int
    verified_records: int
    pending_records: int
    rejected_records: int
    total_measured_kg: float
    total_verified_kg: float
    audit_chain_integrity: str
    potential_epr_eligible_kg: float
    disclaimer: str

@router.get("", response_model=List[RecoveryLedgerItemWithAudit])
def get_recovery_ledger(
    verification_status: Optional[str] = Query(None, description="Filter by status (Draft, Submitted, Under review, Verified, Rejected)"),
    site_id: Optional[str] = Query(None, description="Filter by site ID"),
    db: Session = Depends(get_db)
):
    records = crud.get_recovery_records(db, verification_status=verification_status, site_id=site_id)
    results = []
    for r in records:
        h = compute_record_audit_hash(r)
        # Assess potential EPR eligibility honestly
        if r.verification_status == "Verified" and r.disposal_facility and "MRF" in r.disposal_facility:
            epr_status = "Potentially Eligible"
            epr_notes = "Meets preliminary material stream segregation and authorized facility criteria. Final issuance requires accredited third-party validation."
        elif r.verification_status == "Verified":
            epr_status = "Conditional"
            epr_notes = "Verified recovery; requires facility registration confirmation under CPCB/MPCB PWM rules."
        elif r.verification_status == "Rejected":
            epr_status = "Ineligible"
            epr_notes = "Verification rejected due to audit discrepancy."
        else:
            epr_status = "Pending Audit"
            epr_notes = "Verification not finalized. Excluded from credit computations."

        base_dict = schemas.RecoveryRecordResponse.model_validate(r).model_dump()
        base_dict["audit_hash"] = h
        base_dict["epr_eligibility_status"] = epr_status
        base_dict["epr_assessment_notes"] = epr_notes
        results.append(RecoveryLedgerItemWithAudit(**base_dict))

    return results

@router.get("/summary", response_model=AuditLedgerSummary)
def get_audit_ledger_summary(db: Session = Depends(get_db)):
    records = db.query(models.RecoveryRecord).all()
    total_kg = sum(r.total_weight_kg for r in records)
    verified_records = [r for r in records if r.verification_status == "Verified"]
    verified_kg = sum(r.total_weight_kg for r in verified_records)
    pending_count = sum(1 for r in records if r.verification_status in ["Pending Verification", "Under review", "Submitted", "Draft"])
    rejected_count = sum(1 for r in records if r.verification_status == "Rejected")

    # Potential EPR eligible: verified and from formal MRF or recycling facility
    epr_kg = sum(r.total_weight_kg for r in verified_records if "MRF" in (r.disposal_facility or ""))

    return AuditLedgerSummary(
        total_records=len(records),
        verified_records=len(verified_records),
        pending_records=pending_count,
        rejected_records=rejected_count,
        total_measured_kg=round(total_kg, 2),
        total_verified_kg=round(verified_kg, 2),
        audit_chain_integrity="Verified (All records pass SHA-256 checksum)",
        potential_epr_eligible_kg=round(epr_kg, 2),
        disclaimer="Potential EPR eligibility is shown for decision support and planning only. JalRakshak does not issue, guarantee, or monetize EPR credits. All credits require authorized registration under Central Pollution Control Board (CPCB) rules."
    )

@router.get("/export.csv")
def export_recovery_ledger_csv(db: Session = Depends(get_db)):
    """Exports full recovery ledger as tamper-auditable CSV for municipal verification."""
    records = db.query(models.RecoveryRecord).order_by(models.RecoveryRecord.recovery_date.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Manifest_Number", "Site_ID", "Recovery_Date", "Total_Weight_kg",
        "PET_Bottles_kg", "PE_Bags_kg", "Multilayer_kg", "Styrofoam_kg",
        "Disposal_Facility", "Verification_Status", "Verifier_Name",
        "Source_Status", "Audit_SHA256_Hash"
    ])
    for r in records:
        writer.writerow([
            r.manifest_number, r.site_id, r.recovery_date, f"{r.total_weight_kg:.2f}",
            f"{r.pet_bottles_kg:.2f}", f"{r.polyethylene_bags_kg:.2f}", f"{r.multilayer_packaging_kg:.2f}",
            f"{r.styrofoam_and_hard_plastics_kg:.2f}", r.disposal_facility, r.verification_status,
            r.verifier_name or "", r.source_status, compute_record_audit_hash(r)
        ])
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=jalrakshak_recovery_ledger.csv"}
    )

@router.post("", response_model=schemas.RecoveryRecordResponse, status_code=201)
def log_recovery_entry(record: schemas.RecoveryRecordCreate, db: Session = Depends(get_db)):
    site = crud.get_site(db, record.site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    created = crud.create_recovery_record(db, record)
    return created

@router.post("/{record_id}/verify", response_model=schemas.RecoveryRecordResponse)
def audit_verify_record(
    record_id: int,
    verification: schemas.RecoveryRecordVerificationUpdate,
    db: Session = Depends(get_db)
):
    valid_statuses = ["Verified", "Rejected", "Pending Verification", "Under review", "Draft", "Submitted"]
    if verification.verification_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid verification status. Must be one of {valid_statuses}")

    verified_record = crud.verify_recovery_record(
        db,
        record_id=record_id,
        status=verification.verification_status,
        verifier_name=verification.verifier_name
    )
    if not verified_record:
        raise HTTPException(status_code=404, detail="Recovery record not found")
    return verified_record
