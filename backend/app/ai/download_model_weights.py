"""
Robust Downloader for Pretrained Model A weights from Zenodo
(Detection of floating plastic litter and water hyacinths - van Emmerik et al., 2025)
Zenodo record: 12800597
"""

import os
import sys
import time
import zipfile
import requests

ZENODO_URL = "https://zenodo.org/records/12800597/files/trained_weights.zip?download=1"
WEIGHTS_DIR = os.path.dirname(os.path.abspath(__file__)) + "/weights"
ZIP_PATH = os.path.join(WEIGHTS_DIR, "trained_weights.zip")

def download_with_resume(url: str, dest_path: str, max_retries: int = 20):
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

    # Get total remote size
    head_resp = requests.head(url, headers=headers, allow_redirects=True, timeout=30)
    total_size = int(head_resp.headers.get("content-length", 11345833))
    print(f"[Zenodo Downloader] Target file size: {total_size} bytes ({total_size/(1024*1024):.2f} MB)", flush=True)

    for attempt in range(max_retries):
        curr_size = os.path.getsize(dest_path) if os.path.exists(dest_path) else 0
        if curr_size >= total_size:
            print(f"[Zenodo Downloader] Download complete ({curr_size} bytes).", flush=True)
            break

        print(f"[Zenodo Downloader] Attempt {attempt+1}/{max_retries}: Resuming from {curr_size}/{total_size} bytes ({curr_size/total_size*100:.1f}%)...", flush=True)
        req_headers = headers.copy()
        if curr_size > 0:
            req_headers["Range"] = f"bytes={curr_size}-"

        try:
            with requests.get(url, headers=req_headers, stream=True, timeout=45) as r:
                if r.status_code in (200, 206):
                    mode = "ab" if curr_size > 0 and r.status_code == 206 else "wb"
                    if mode == "wb":
                        curr_size = 0
                    with open(dest_path, mode) as f:
                        for chunk in r.iter_content(chunk_size=1024 * 64):
                            if chunk:
                                f.write(chunk)
                                curr_size += len(chunk)
                                if curr_size % (1024 * 512) < (1024 * 64):
                                    print(f"  Downloaded: {curr_size}/{total_size} ({curr_size/total_size*100:.1f}%)", flush=True)
                else:
                    print(f"[Zenodo Downloader] HTTP error {r.status_code}. Retrying...", flush=True)
                    time.sleep(2)
        except Exception as e:
            print(f"[Zenodo Downloader] Transient network issue ({e}). Retrying in 2s...", flush=True)
            time.sleep(2)

    # Verify and extract
    if os.path.exists(dest_path) and os.path.getsize(dest_path) >= total_size:
        print("[Zenodo Downloader] Verifying and extracting ZIP archive...", flush=True)
        try:
            with zipfile.ZipFile(dest_path, "r") as z:
                z.extractall(WEIGHTS_DIR)
                print(f"[Zenodo Downloader] Extracted weights: {z.namelist()}", flush=True)
            print("[Zenodo Downloader] Model A weights ready for inference!", flush=True)
            return True
        except Exception as e:
            print(f"[Zenodo Downloader] Extraction error: {e}", flush=True)
            return False
    else:
        print("[Zenodo Downloader] File incomplete.", flush=True)
        return False

if __name__ == "__main__":
    download_with_resume(ZENODO_URL, ZIP_PATH)
