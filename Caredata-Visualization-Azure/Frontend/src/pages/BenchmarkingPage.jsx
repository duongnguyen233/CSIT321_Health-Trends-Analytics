import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { getQIAggregates } from "../services/api";
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

// AIHW published national medians — these don't change with uploads
// id must match backend analysis indicator id
const NATIONAL_MEDIANS = [
  { id: "pi",              name: "Pressure injuries",     nat: 10.2, lib: true,  unit: "%",   convert: null },
  { id: "falls",           name: "Falls & major injury",  nat: 8.3,  lib: true,  unit: "%",   convert: null },
  { id: "uwl",             name: "Unplanned weight loss", nat: 5.1,  lib: true,  unit: "%",   convert: null },
  { id: "meds",            name: "Medications (poly)",    nat: 19.8, lib: true,  unit: "%",   convert: null },
  { id: "adl",             name: "ADL decline",           nat: 20.1, lib: true,  unit: "%",   convert: null },
  { id: "incontinence",    name: "Incontinence (IAD)",    nat: 6.9,  lib: true,  unit: "%",   convert: null },
  { id: "rp",              name: "Restrictive practices", nat: 7.8,  lib: true,  unit: "%",   convert: null },
  { id: "hosp",            name: "Hospitalisation",       nat: 11.0, lib: true,  unit: "%",   convert: null },
  { id: "allied_health",   name: "Allied health gap",     nat: 34.0, lib: true,  unit: "%",   convert: null },
  { id: "consumer_exp",    name: "Consumer experience",   nat: 75,   lib: false, unit: "%",   convert: "score24_to_pct" },
  { id: "qol",             name: "Quality of life",       nat: 66,   lib: false, unit: "%",   convert: "score24_to_pct" },
  { id: "workforce",       name: "Workforce adequacy",    nat: 90,   lib: false, unit: "%",   convert: null },
  { id: "enrolled_nursing", name: "Enrolled nursing",     nat: 91,   lib: false, unit: "%",   convert: null },
  { id: "lifestyle",       name: "Lifestyle sessions",    nat: 2.1,  lib: false, unit: "avg", convert: null },
];


function convertFacilityRate(indicator, natEntry) {
  if (indicator.currentRate == null) return null;
  const rate = indicator.currentRate;
  // CE/QoL scores are 0-24 in new schema; convert to % for comparison with national median
  if (natEntry.convert === "score24_to_pct" && indicator.valueDisplay?.includes("/24")) {
    return Math.round((rate / 24) * 100 * 10) / 10;
  }
  return Math.round(rate * 10) / 10;
}

function buildIndicators(indicators) {
  return NATIONAL_MEDIANS.map((natEntry) => {
    const csvInd = indicators?.find((i) => i.id === natEntry.id);
    let fac = null;
    if (csvInd) {
      fac = convertFacilityRate(csvInd, natEntry);
    }
    return { ...natEntry, fac: fac ?? 0, noFacData: fac == null };
  });
}

function getStatus(ind) {
  const worse = ind.lib ? ind.fac > ind.nat : ind.fac < ind.nat;
  const diff = Math.abs(ind.fac - ind.nat);
  if (diff < 0.5) return "amber";
  return worse ? "red" : "green";
}

function getPercentile(ind) {
  const worse = ind.lib ? ind.fac > ind.nat : ind.fac < ind.nat;
  const diff = ind.nat ? Math.abs(ind.fac - ind.nat) / ind.nat : 0;
  if (diff < 0.03) return { label: "~50th", cls: "amber" };
  if (worse) return diff > 0.1 ? { label: "75th+", cls: "red" } : { label: "60th", cls: "amber" };
  return diff > 0.1 ? { label: "25th", cls: "green" } : { label: "40th", cls: "green" };
}

function computeSummary(indicators) {
  let above = 0, below = 0, atMedian = 0;
  indicators.forEach((ind) => {
    const s = getStatus(ind);
    if (s === "red") above++;
    else if (s === "green") below++;
    else atMedian++;
  });
  const betterRatio = below / indicators.length;
  const percentile = Math.round(50 - (betterRatio - 0.5) * 40);
  return { above, below, atMedian, percentile: Math.max(1, Math.min(99, percentile)) };
}

function buildDiffData(indicators) {
  return indicators.map((i) => {
    const d = i.lib ? i.fac - i.nat : i.nat - i.fac;
    return { name: i.name.length > 18 ? i.name.slice(0, 18) + "\u2026" : i.name, diff: Math.round(d * 10) / 10 };
  });
}

function buildPercentileTrend(aggregates, quarterLabels) {
  if (!quarterLabels.length) return [];
  // For each quarter, count how many indicators are worse than national
  return quarterLabels.map((q, qi) => {
    let aboveCount = 0;
    // Find the aggregate for this quarter index
    const agg = aggregates[qi];
    const aggIndicators = agg?.indicators || [];
    NATIONAL_MEDIANS.forEach((natEntry) => {
      const csvInd = aggIndicators.find((a) => a.id === natEntry.id);
      const rate = csvInd?.ratePerQuarter?.[qi] ?? csvInd?.currentRate;
      if (rate == null) return;
      let facRate = rate;
      if (natEntry.convert === "score24_to_pct") facRate = (rate / 24) * 100;
      const worse = natEntry.lib ? facRate > natEntry.nat : facRate < natEntry.nat;
      if (worse) aboveCount++;
    });
    const ratio = aboveCount / NATIONAL_MEDIANS.length;
    return { name: q, facility: Math.round(50 + ratio * 30), national: 50 };
  });
}

export default function BenchmarkingPage() {
  const [peerGroup, setPeerGroup] = useState("All facilities");
  const [sizeFilter, setSizeFilter] = useState("All sizes");
  const [loading, setLoading] = useState(true);
  const [aggregates, setAggregates] = useState([]);
  const [quarterLabels, setQuarterLabels] = useState([]);
  const [quarterIndex, setQuarterIndex] = useState(0);
  const [latestIndicators, setLatestIndicators] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await getQIAggregates();
        if (cancelled) return;
        const aggs = resp?.aggregates || [];
        const labels = resp?.quarterLabels || [];
        setAggregates(aggs);
        setQuarterLabels(labels);
        if (aggs.length) {
          setQuarterIndex(aggs.length - 1);
          // Use the latest aggregate's indicators
          setLatestIndicators(aggs[aggs.length - 1]?.indicators || []);
        }
      } catch (err) {
        console.warn("Benchmarking: failed to load QI aggregates", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // When quarter index changes, update the indicators to match that quarter
  useEffect(() => {
    if (!aggregates.length) return;
    const agg = aggregates[Math.min(quarterIndex, aggregates.length - 1)];
    if (agg?.indicators) {
      setLatestIndicators(agg.indicators);
    }
  }, [quarterIndex, aggregates]);

  const hasRealData = latestIndicators.length > 0;
  const indicators = buildIndicators(hasRealData ? latestIndicators : null);
  const currentQuarterLabel = quarterLabels.length > 0 ? quarterLabels[Math.min(quarterIndex, quarterLabels.length - 1)] : "\u2014";
  const summary = computeSummary(indicators);
  const diffData = buildDiffData(indicators);
  const percentileTrend = hasRealData
    ? buildPercentileTrend(aggregates, quarterLabels)
    : [];

  const maxVal = Math.max(...indicators.map((i) => Math.max(i.fac, i.nat)), 1);
  const scale = 100 / (maxVal * 1.1);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow pt-32 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto w-full">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-1">
              <span className="font-bold">Benchmarking</span> — Facility vs national
            </h1>
            <p className="text-base text-gray-500">
              Facility rates compared against AIHW published national medians{currentQuarterLabel !== "\u2014" ? ` \u00b7 ${currentQuarterLabel}` : ""}
            </p>
          </div>
          <div className="text-sm text-gray-400">Source: AIHW QI Program Report 2024</div>
        </div>

        {/* Empty state */}
        {!loading && !hasRealData && (
          <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            No QI data uploaded yet. <Link to="/upload-csv" className="text-primary font-medium hover:underline">Upload a CSV</Link> to see your facility's benchmarking data against national medians.
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
            <p className="text-sm">Loading benchmarking data...</p>
          </div>
        )}

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2 py-4 border-b border-gray-200">
          <span className="text-sm text-gray-500 mr-1">Peer group:</span>
          {["All facilities", "Metro", "Regional", "Rural"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setPeerGroup(opt)}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                peerGroup === opt
                  ? "bg-gray-900 text-primary border-gray-900 font-medium"
                  : "bg-white border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
              }`}
            >
              {opt}
            </button>
          ))}
          <span className="w-px h-5 bg-gray-200 mx-2" />
          <span className="text-sm text-gray-500 mr-1">Size:</span>
          {["All sizes", "< 60 beds", "60\u2013120 beds", "> 120 beds"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setSizeFilter(opt)}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                sizeFilter === opt
                  ? "bg-gray-900 text-primary border-gray-900 font-medium"
                  : "bg-white border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
              }`}
            >
              {opt}
            </button>
          ))}
          {quarterLabels.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <button type="button" className="w-8 h-8 rounded-lg border border-gray-300 bg-white text-gray-600 flex items-center justify-center hover:bg-gray-100 transition disabled:opacity-50"
                onClick={() => setQuarterIndex((i) => Math.max(0, i - 1))} disabled={quarterIndex <= 0}>{"\u2039"}</button>
              <span className="text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1.5 min-w-[100px] text-center">
                {currentQuarterLabel}
              </span>
              <button type="button" className="w-8 h-8 rounded-lg border border-gray-300 bg-white text-gray-600 flex items-center justify-center hover:bg-gray-100 transition disabled:opacity-50"
                onClick={() => setQuarterIndex((i) => Math.min(quarterLabels.length - 1, i + 1))} disabled={quarterIndex >= quarterLabels.length - 1}>{"\u203a"}</button>
            </div>
          )}
          {quarterLabels.length === 0 && !loading && (
            <span className="ml-auto text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1.5">
              Sample data
            </span>
          )}
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 mt-6">
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Above national median</div>
            <div className="text-2xl font-semibold text-red-600">{summary.above}</div>
            <div className="text-sm text-gray-500 mt-1">of 14 indicators</div>
          </div>
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Below national median</div>
            <div className="text-2xl font-semibold text-green-600">{summary.below}</div>
            <div className="text-sm text-gray-500 mt-1">performing better</div>
          </div>
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">At national median</div>
            <div className="text-2xl font-semibold text-amber-600">{summary.atMedian}</div>
            <div className="text-sm text-gray-500 mt-1">within {"\u00b1"}0.5%</div>
          </div>
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Facility percentile</div>
            <div className="text-2xl font-semibold text-amber-600">{summary.percentile}nd</div>
            <div className="text-sm text-gray-500 mt-1">overall ranking</div>
          </div>
        </div>

        {/* Main comparison card */}
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Facility vs national median — all 14 indicators</h2>
          <p className="text-sm text-gray-500 mb-4">
            Each bar shows your facility rate (coloured) vs national median (grey). Red = above national median (worse). Green = below (better).
          </p>

          {/* Legend */}
          <div className="flex flex-wrap gap-6 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-3 h-3 rounded-sm bg-red-500" />
              Facility — above national (worse)
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-3 h-3 rounded-sm bg-green-600" />
              Facility — below national (better)
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-3 h-3 rounded-sm bg-gray-300 opacity-70" />
              National median
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-0.5 h-3 rounded-full bg-gray-500 opacity-60" />
              Median marker
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[minmax(140px,180px)_1fr_70px_70px_70px] gap-2 sm:gap-3 px-2 py-1 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider min-w-[600px]">
            <div>Indicator</div>
            <div>Rate comparison</div>
            <div className="text-right">Facility</div>
            <div className="text-right">National</div>
            <div className="text-right">Percentile</div>
          </div>

          {/* Indicator rows */}
          <div className="space-y-2 overflow-x-auto">
            {indicators.map((ind) => {
              const status = getStatus(ind);
              const pct = getPercentile(ind);
              const facW = Math.min(100, (ind.fac * scale));
              const natW = Math.min(100, (ind.nat * scale));
              const medPos = Math.min(100, (ind.nat * scale));
              const barColor = status === "red" ? "bg-red-500" : status === "amber" ? "bg-amber-500" : "bg-green-600";
              const textColor = status === "red" ? "text-red-600" : status === "amber" ? "text-amber-600" : "text-green-600";
              const pctColor = pct.cls === "red" ? "text-red-600" : pct.cls === "amber" ? "text-amber-600" : "text-green-600";
              return (
                <div
                  key={ind.name}
                  className="grid grid-cols-[minmax(140px,180px)_1fr_70px_70px_70px] gap-2 sm:gap-3 items-center py-2.5 px-3 rounded-lg bg-gray-50 border border-gray-100 hover:bg-primary-light/50 hover:border-primary-light transition min-w-[600px]"
                >
                  <div className="text-sm font-medium text-gray-900 truncate">{ind.name}</div>
                  <div className="relative h-5 bg-gray-200 rounded overflow-visible">
                    <div className="absolute inset-y-1 left-0 rounded bg-gray-300 opacity-50 transition-all" style={{ width: `${natW}%` }} />
                    <div className={`absolute inset-y-1 left-0 rounded opacity-90 transition-all ${barColor}`} style={{ width: `${facW}%` }} />
                    <div className="absolute top-0 w-0.5 h-5 bg-gray-500 opacity-40 rounded-full" style={{ left: `${medPos}%` }} />
                  </div>
                  <div className={`text-sm font-medium text-right ${ind.noFacData ? "text-gray-400" : textColor}`}>
                    {ind.noFacData ? "—" : `${ind.fac}${ind.unit}`}
                  </div>
                  <div className="text-sm text-gray-500 text-right">{ind.nat}{ind.unit}</div>
                  <div className={`text-xs font-semibold text-right ${pctColor}`}>{pct.label}</div>
                </div>
              );
            })}
          </div>

          {/* AIHW note */}
          <div className="flex items-start gap-2 mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              National medians sourced from AIHW QI Program national report. Lower rates are better for most indicators. Consumer experience, Quality of life, Workforce and Enrolled nursing are scored higher = better.
              {hasRealData ? " Facility rates computed from your uploaded QI data." : " Upload a CSV to see your facility rates compared against national medians."}
            </span>
          </div>
        </div>

        {/* Bottom charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-1">Facility percentile trend</h3>
            <p className="text-sm text-gray-500 mb-4">
              Overall ranking vs national peer group{quarterLabels.length > 0 ? ` — ${quarterLabels.length} quarters` : ""}
            </p>
            {percentileTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={percentileTrend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis domain={[30, 80]} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="facility" stroke="#D2C7E5" strokeWidth={2} dot={{ r: 3 }} name="Facility percentile" />
                  <Line type="monotone" dataKey="national" stroke="#9ca3af" strokeDasharray="4 4" strokeWidth={2} dot={false} name="National median (50th)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                Upload QI data to see percentile trend
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-1">Above / below national by indicator</h3>
            <p className="text-sm text-gray-500 mb-4">Difference from national median — positive = worse than national</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={diffData} margin={{ top: 5, right: 5, left: 5, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip />
                <Bar dataKey="diff" name="Diff from national (%)" radius={4}>
                  {diffData.map((entry, index) => (
                    <Cell key={index} fill={entry.diff > 0 ? "#dc2626" : "#16a34a"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
