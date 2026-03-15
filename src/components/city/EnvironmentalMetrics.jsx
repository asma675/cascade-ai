import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Thermometer, Droplets, Wind, Gauge } from 'lucide-react';

function IndexBadge({ label, value, unit, sub }) {
  return (
    <div className="mt-3 rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-slate-400 text-sm font-medium">{label}</span>
        <span className="text-cyan-300 font-mono font-semibold">
          {value != null && value !== '' ? `${value}${unit || ''}` : '—'}
        </span>
      </div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export default function EnvironmentalMetrics({ environmentalData, city }) {
  const [timeWindow, setTimeWindow] = useState('30d');
  const [clientSpi, setClientSpi] = useState(null);
  const [clientSpiDetails, setClientSpiDetails] = useState(null);
  const [clientCurrentMonthPrecipMm, setClientCurrentMonthPrecipMm] = useState(null);

  if (!environmentalData) return null;

  const indices = environmentalData.indices || {};
  const baseline = environmentalData.baseline;

  const computedEHF = useMemo(() => {
    if (indices.ehf != null) return null;
    const recentDailyMeansRaw = baseline?.recentDailyMeans ?? baseline?.recentMeanTemps ?? baseline?.recent_daily_means;
    const recentMaxTempsRaw = baseline?.recentMaxTemps ?? baseline?.recent_max_temps;
    const T95Raw = baseline?.T95 ?? baseline?.t95;
    let arr = Array.isArray(recentDailyMeansRaw)
      ? recentDailyMeansRaw.map((v) => Number(v)).filter((v) => !Number.isNaN(v))
      : Array.isArray(recentMaxTempsRaw)
        ? recentMaxTempsRaw.map((v) => Number(v)).filter((v) => !Number.isNaN(v))
        : [];
    let T95 = T95Raw != null ? Number(T95Raw) : NaN;
    const minDays = 21;
    if (arr.length < minDays && environmentalData.temperature_30d?.length >= minDays) {
      const tempSeries = environmentalData.temperature_30d
        .map((d) => (typeof d.value === 'number' ? d.value : Number(d.value)))
        .filter((v) => !Number.isNaN(v));
      if (tempSeries.length >= minDays) {
        arr = tempSeries;
        const sorted = [...tempSeries].sort((a, b) => a - b);
        T95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
      }
    }
    if (arr.length < minDays || Number.isNaN(T95)) return null;
    const T3 = arr.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const T30 = arr.reduce((a, b) => a + b, 0) / arr.length;
    const EHI_sig = T3 - T95;
    const EHI_accl = T3 - T30;
    const EHF = Math.max(0, EHI_sig * Math.max(1, EHI_accl));
    return { ehf: EHF, details: { T95, T3, T30, EHI_sig, EHI_accl } };
  }, [indices.ehf, baseline, environmentalData.temperature_30d]);

  const ehf = indices.ehf ?? computedEHF?.ehf;
  const ehfDetails = indices.ehf_details ?? computedEHF?.details;
  const spi = indices.spi ?? clientSpi;
  const spiDetails = indices.spi_details ?? clientSpiDetails;
  const currentMonthPrecipMm = indices.current_month_precip_mm ?? clientCurrentMonthPrecipMm;

  useEffect(() => {
    if (indices.spi != null || !city?.latitude || !city?.longitude) return;
    const longitude = city.longitude;
    const latitude = city.latitude;
    const endYear = Math.min(new Date().getFullYear(), 2025);
    const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=PRECTOTCORR&community=AG&longitude=${longitude}&latitude=${latitude}&start=1981&end=${endYear}&format=JSON`;
    let cancelled = false;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const monthlyParams = data?.properties?.parameter?.PRECTOTCORR;
        if (!monthlyParams || typeof monthlyParams !== 'object') return;
        const monthKeys = Object.keys(monthlyParams).filter((k) => /^\d{6}$/.test(k)).sort();
        if (monthKeys.length < 12) return;
        const monthlyTotalsMm = {};
        for (const key of monthKeys) {
          const val = monthlyParams[key];
          if (val == null || val === -999) continue;
          const y = parseInt(key.substring(0, 4), 10);
          const m = parseInt(key.substring(4, 6), 10);
          monthlyTotalsMm[key] = val * daysInMonth(y, m);
        }
        const lastKey = monthKeys[monthKeys.length - 1];
        const endYear = parseInt(lastKey.substring(0, 4), 10);
        const endMonth = parseInt(lastKey.substring(4, 6), 10);
        const historical12mo = [];
        for (let year = 1981; year <= endYear; year++) {
          let sum = 0;
          let hasAll = true;
          for (let i = 0; i < 12; i++) {
            let m = endMonth - 11 + i;
            let y = year;
            if (m <= 0) {
              m += 12;
              y -= 1;
            }
            const k = `${y}${String(m).padStart(2, '0')}`;
            if (monthlyTotalsMm[k] == null) {
              hasAll = false;
              break;
            }
            sum += monthlyTotalsMm[k];
          }
          if (hasAll) historical12mo.push(sum);
        }
        if (historical12mo.length >= 2) {
          const current12mo = historical12mo[historical12mo.length - 1];
          const mean = historical12mo.reduce((a, b) => a + b, 0) / historical12mo.length;
          const variance = historical12mo.reduce((s, v) => s + (v - mean) ** 2, 0) / historical12mo.length;
          const std = Math.sqrt(variance);
          if (std > 0) {
            const spiVal = (current12mo - mean) / std;
            setClientSpi(spiVal);
            setClientSpiDetails({
              mean_12mo_mm: mean,
              std_12mo_mm: std,
              n_years: historical12mo.length,
              current_12mo_mm: current12mo
            });
            setClientCurrentMonthPrecipMm(current12mo);
          }
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [city?.latitude, city?.longitude, indices.spi]);

  useEffect(() => {
    console.group('[EnvironmentalMetrics] Index calculations');
    console.log('environmental_data keys:', environmentalData ? Object.keys(environmentalData) : []);
    console.log('environmental_data.baseline:', baseline, baseline ? `keys: ${Object.keys(baseline).join(', ')}` : '');
    if (baseline) {
      const rt = baseline.recentMaxTemps ?? baseline.recent_max_temps;
      console.log('baseline.recentMaxTemps length:', Array.isArray(rt) ? rt.length : typeof rt, rt ? (Array.isArray(rt) ? rt.slice(0, 3) : rt) : '');
      console.log('baseline.T95:', baseline.T95 ?? baseline.t95);
    }
    console.log('temperature_30d length:', environmentalData?.temperature_30d?.length);
    console.log('environmental_data.indices (raw):', indices);
    console.log('EHF (Excess Heat Factor):', ehf, ehf != null ? `→ displayed: ${Number(ehf).toFixed(2)}` : '→ missing (shows —)');
    if (ehfDetails) {
      console.log('EHF details:', {
        T95: ehfDetails.T95,
        T3: ehfDetails.T3,
        T30: ehfDetails.T30,
        EHI_sig: ehfDetails.EHI_sig,
        EHI_accl: ehfDetails.EHI_accl,
        formula: 'EHF = EHI_sig × max(1, EHI_accl)'
      });
    }
    console.log('SPI (Standardized Precipitation Index):', spi, spi != null ? `→ displayed: ${Number(spi).toFixed(2)}` : '→ missing (shows —)');
    if (spiDetails) {
      console.log('SPI details:', {
        mean_mm: spiDetails.mean_mm,
        std_mm: spiDetails.std_mm,
        same_month_count: spiDetails.same_month_count,
        current_month_precip_mm: currentMonthPrecipMm,
        formula: 'SPI = (current_month_total_mm - mean) / std_mm'
      });
    }
    console.groupEnd();
  }, [environmentalData, baseline, indices, ehf, ehfDetails, spi, spiDetails, currentMonthPrecipMm]);

  const metrics = [
    {
      id: 'temperature',
      label: 'Temperature',
      icon: Thermometer,
      color: '#ef4444',
      data: environmentalData.temperature_30d,
      unit: '°C',
      indexBlock: (
        <>
          <IndexBadge
            label="EHF (Excess Heat Factor)"
            value={ehf != null ? Number(ehf).toFixed(2) : null}
            sub={ehf != null && ehf > 0 ? 'Heatwave index (positive = excess heat)' : null}
          />
          {ehfDetails && (
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400">
              <span>T₉₅: {Number(ehfDetails.T95).toFixed(1)}°C</span>
              <span>T₃: {Number(ehfDetails.T3).toFixed(1)}°C</span>
              <span>T₃₀: {Number(ehfDetails.T30).toFixed(1)}°C</span>
              <span>EHI_sig: {Number(ehfDetails.EHI_sig).toFixed(2)}</span>
              <span>EHI_accl: {Number(ehfDetails.EHI_accl).toFixed(2)}</span>
            </div>
          )}
        </>
      )
    },
    {
      id: 'precipitation',
      label: 'Precipitation',
      icon: Droplets,
      color: '#3b82f6',
      data: environmentalData.precipitation_30d,
      unit: 'mm',
      indexBlock: (
        <>
          <IndexBadge
            label="SPI-12 (12-month Standardized Precipitation Index)"
            value={spi != null ? Number(spi).toFixed(2) : null}
            sub={
              (spiDetails?.current_12mo_mm ?? currentMonthPrecipMm) != null
                ? `Current 12-month total: ${Number(spiDetails?.current_12mo_mm ?? currentMonthPrecipMm).toFixed(0)} mm`
                : null
            }
          />
          {spiDetails && (
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400">
              <span>Mean 12-mo: {Number(spiDetails.mean_12mo_mm ?? spiDetails.mean_mm ?? 0).toFixed(0)} mm</span>
              <span>Std dev: {Number(spiDetails.std_12mo_mm ?? spiDetails.std_mm ?? 0).toFixed(0)} mm</span>
              <span>n: {spiDetails.n_years ?? spiDetails.same_month_count ?? 0} years</span>
            </div>
          )}
        </>
      )
    },
    {
      id: 'wind',
      label: 'Wind Speed',
      icon: Wind,
      color: '#06b6d4',
      data: environmentalData.wind_30d,
      unit: 'm/s'
    },
    {
      id: 'pressure',
      label: 'Air Pressure',
      icon: Gauge,
      color: '#8b5cf6',
      data: environmentalData.pressure_30d,
      unit: 'hPa'
    }
  ];

  return (
    <Card className="bg-slate-900 border-slate-800 p-6">
      <h2 className="text-2xl font-bold text-cyan-400 mb-4">Environmental Metrics</h2>

      <Tabs value={timeWindow} onValueChange={setTimeWindow} className="mb-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="7d">7 Days</TabsTrigger>
          <TabsTrigger value="30d">30 Days</TabsTrigger>
          <TabsTrigger value="95d">95 Days</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.id} className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-5 h-5" style={{ color: metric.color }} />
                <span className="text-slate-200 font-medium">{metric.label}</span>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={metric.data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" style={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#cbd5e1' }}
                  />
                  <Line type="monotone" dataKey="value" stroke={metric.color} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              {metric.indexBlock}
            </div>
          );
        })}
      </div>
    </Card>
  );
}