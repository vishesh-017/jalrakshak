import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Activity, Battery, Signal, Radio, Settings2, RefreshCw } from 'lucide-react';
import { getIoTDevices, getSites, ingestIoTSensorData, type IoTDevice } from '../lib/api';
import type { MonitoringSite } from '../types';
import { useRbac } from '../context/RbacContext';

export default function IoTManagementPage() {
  const { user } = useRbac();
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [sites, setSites] = useState<MonitoringSite[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Simulator state
  const [simWaterLevel, setSimWaterLevel] = useState(1.0);
  const [simPlastic, setSimPlastic] = useState("Low");
  
  const load = async () => {
    try {
      const [d, s] = await Promise.all([getIoTDevices(), getSites()]);
      setDevices(d);
      
      const filteredSites = user.zoneScope === 'All Mumbai Basins (City-wide Command)'
        ? s
        : s.filter(site => user.allowedBasins.includes(site.zone));
      setSites(filteredSites);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sendSimulatedPayload = async (siteId: string) => {
    let fetchedRainfall = 0;
    const site = sites.find(s => s.id === siteId);
    
    if (site) {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${site.latitude}&longitude=${site.longitude}&current=precipitation`);
        const data = await res.json();
        if (data?.current?.precipitation !== undefined) {
          fetchedRainfall = data.current.precipitation;
        }
      } catch (err) {
        console.error("Open-Meteo API Error:", err);
      }
    }

    await ingestIoTSensorData({
      device_id: `ESP32-${siteId}`,
      timestamp: new Date().toISOString(),
      water_level_cm: simWaterLevel * 100, // convert m to cm
      rainfall_mm: fetchedRainfall,
      plastic_detection: simPlastic,
      camera_status: "Operational",
      battery_level: 95.0,
      signal_strength: -65.0
    });
    load();
  };

  if (loading) return <div className="p-8 text-cyan-400 flex items-center justify-center h-full">Loading IoT telemetry...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="text-cyan-400 w-6 h-6" />
          IoT Device Management
        </h1>
        <Button onClick={load} variant="outline" size="sm" className="border-cyan-700 text-cyan-300">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      {/* Simulator Control Panel */}
      <Card className="bg-[#050e1b] border-cyan-900/50">
        <CardHeader>
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-cyan-400" />
            Telemetry Simulator Control Panel (Live Simulation)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400">Water Level (m)</label>
              <input 
                type="number" 
                step="0.1" 
                value={simWaterLevel} 
                onChange={e => setSimWaterLevel(parseFloat(e.target.value))}
                className="w-full bg-[#030914] border border-cyan-900/50 rounded px-3 py-1.5 text-white text-sm mt-1 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Plastic Accumulation</label>
              <select 
                value={simPlastic} 
                onChange={e => setSimPlastic(e.target.value)}
                className="w-full bg-[#030914] border border-cyan-900/50 rounded px-3 py-1.5 text-white text-sm mt-1 focus:outline-none focus:border-cyan-500"
              >
                <option value="Low">Low (Safe)</option>
                <option value="Medium">Medium (Warning)</option>
                <option value="High">High (Critical Choke)</option>
              </select>
            </div>
          </div>
          <div className="pt-2">
            <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide flex items-center justify-between">
              <span>Trigger Scenario for Site:</span>
              <span className="text-[10px] text-cyan-500 normal-case flex items-center gap-1 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/50">
                <RefreshCw className="w-3 h-3" />
                Rainfall auto-fetched via Open-Meteo
              </span>
            </p>
            <div className="flex gap-2 flex-wrap">
              {sites.map(s => (
                <Button 
                  key={s.id} 
                  size="sm" 
                  onClick={() => sendSimulatedPayload(s.id)}
                  className="bg-cyan-950/50 border border-cyan-700/50 hover:bg-cyan-900 text-xs text-cyan-100"
                >
                  {s.id}: {s.name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Devices List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {devices.map(device => {
          const site = sites.find(s => s.id === device.site_id);
          return (
            <Card key={device.id} className="bg-[#050e1b] border-cyan-900/50 hover:border-cyan-500/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-cyan-400" />
                      {device.id}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{site?.name || device.site_id}</p>
                  </div>
                  <Badge className={device.status === 'Online' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'}>
                    {device.status}
                  </Badge>
                </div>
                
                <div className="space-y-2.5 text-xs bg-[#030914] p-3 rounded-lg border border-cyan-950">
                  <div className="flex justify-between pb-1">
                    <span className="text-slate-500">Source Mode</span>
                    <span className={device.is_simulated ? "text-amber-400 font-semibold" : "text-cyan-400 font-semibold"}>
                      {device.is_simulated ? "SIMULATED" : "LIVE SENSOR"}
                    </span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-slate-500 flex items-center gap-1"><Battery className="w-3.5 h-3.5"/> Power</span>
                    <span className="text-slate-300 font-mono">{device.battery_level ? `${device.battery_level}%` : '--'}</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-slate-500 flex items-center gap-1"><Signal className="w-3.5 h-3.5"/> Signal (RSSI)</span>
                    <span className="text-slate-300 font-mono">{device.signal_strength ? `${device.signal_strength} dBm` : '--'}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/60 mt-1">
                    <span className="text-slate-500">Last Telemetry</span>
                    <span className="text-slate-300">{device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {devices.length === 0 && (
          <div className="col-span-full p-12 text-center border border-dashed border-cyan-900/50 rounded-2xl bg-[#030914]">
            <Radio className="w-10 h-10 text-cyan-900 mx-auto mb-3" />
            <p className="text-slate-300 text-sm font-semibold">No monitoring devices registered.</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Use the Simulator Control Panel above to bootstrap simulated device telemetry, or connect physical ESP32 hardware.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
