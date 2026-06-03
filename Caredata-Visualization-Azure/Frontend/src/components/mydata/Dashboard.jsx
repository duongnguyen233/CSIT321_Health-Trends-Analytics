import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Search, Sparkles, ArrowUpFromLine } from "../../icons/lucideBundle";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import MobileSidebarPanel, { PAGE_MAIN_ROW } from "../common/MobileSidebarPanel";
import { getMyData, getHealthScanHistory } from "../../services/api";
import { HEALTH_SCAN_RESULT_KEY } from "../../constants";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
} from "recharts";

// ─── Data helpers (preserved from previous impl.) ─────────────────────

function parseNum(s) {
  if (s == null || s === "") return null;
  const n = parseFloat(String(s).trim());
  return isNaN(n) ? null : n;
}

const PERSONAL_LIKE = new Set([
  "age", "year of birth", "date of birth", "dob", "yob", "birth year", "birth date",
  "height", "weight", "bmi", "sex", "gender", "patient name", "name", "birth", "years old",
  "address", "phone", "id", "patient id", "patient id number",
]);

function isPersonalInfo(label) {
  const lower = String(label).toLowerCase();
  if (PERSONAL_LIKE.has(lower)) return true;
  if (lower.includes("year of birth") || lower.includes("date of birth") || lower.includes("patient name")) return true;
  if (lower.includes("birth") && (lower.includes("year") || lower.includes("date"))) return true;
  if (lower === "name" || lower === "age") return true;
  return false;
}

function buildChartData(keyInformation, patientContext, clinicalMeasurements, trendAndRisk) {
  const sections = [clinicalMeasurements, keyInformation, trendAndRisk, patientContext];
  const numeric = [];
  sections.forEach((section) => {
    if (!section || typeof section !== "object") return;
    Object.entries(section).forEach(([label, value]) => {
      const n = parseNum(value);
      if (n != null && isFinite(n)) {
        const shortName = label.length > 18 ? label.slice(0, 16) + "…" : label;
        numeric.push({ name: shortName, value: n, fullLabel: label });
      }
    });
  });
  const healthOnly = numeric.filter((e) => !isPersonalInfo(e.fullLabel));

  const maxValR = Math.max(...healthOnly.map((d) => d.value), 1);
  const radar = healthOnly.slice(0, 6).map((d) => ({
    subject: d.name,
    A: d.value,
    fullMark: Math.max(maxValR * 1.2, 10),
  }));
  const bars = healthOnly.map((d) => ({ name: d.name, value: d.value }));
  const line = healthOnly.map((d) => ({ name: d.name, value: d.value }));

  const tableRows = [];
  [keyInformation, patientContext, clinicalMeasurements, trendAndRisk].forEach((section) => {
    if (!section || typeof section !== "object") return;
    Object.entries(section).forEach(([label, value]) => {
      if (value != null && String(value).trim() !== "")
        tableRows.push({ label, value: String(value) });
    });
  });

  return { radarRows: radar, barRows: bars, lineRows: line, tableRows, hasData: bars.length > 0 };
}

function RecContent({ value }) {
  if (value == null) return null;
  if (typeof value === "string")
    return <p className="leading-relaxed whitespace-pre-line text-[13px]" style={{ color: "var(--ink-700)" }}>{value}</p>;
  if (Array.isArray(value)) {
    const text = value.filter(Boolean).map((v) => (typeof v === "string" ? v : String(v))).join("\n");
    return text ? (
      <p className="leading-relaxed whitespace-pre-line text-[13px]" style={{ color: "var(--ink-700)" }}>{text}</p>
    ) : null;
  }
  if (typeof value === "object") {
    return (
      <div className="space-y-2 text-[13px]" style={{ color: "var(--ink-700)" }}>
        {Object.entries(value).map(([k, v]) => {
          if (v == null || v === "") return null;
          const label = String(k).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const text = typeof v === "string" ? v : JSON.stringify(v);
          return (
            <div key={k}>
              <span className="font-medium" style={{ color: "var(--ink-900)" }}>{label}: </span>
              <span className="whitespace-pre-line">{text}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return <p className="text-[13px]" style={{ color: "var(--ink-700)" }}>{String(value)}</p>;
}

function getByKey(obj, ...keys) {
  if (!obj || typeof obj !== "object") return null;
  const lowerKeys = keys.map((k) => String(k).toLowerCase());
  for (const [objKey, val] of Object.entries(obj)) {
    if (val == null || String(val).trim() === "") continue;
    if (keys.includes(objKey) || lowerKeys.includes(String(objKey).toLowerCase())) return String(val).trim();
  }
  return null;
}

function hasAnyData(sections) {
  return sections.some((s) => {
    if (!s || typeof s !== "object") return false;
    return Object.values(s).some((v) => v != null && String(v).trim() !== "");
  });
}

function deriveKpis(keyInformation, clinicalMeasurements, trendAndRisk) {
  const kpis = [];

  const totalIge = getByKey(keyInformation, "Total IgE") || getByKey(clinicalMeasurements, "Total IgE");
  if (totalIge) {
    kpis.push({
      label: "Total IgE",
      value: String(totalIge).split(" ")[0].replace(/[^\d.]/g, "") || totalIge,
      sub: getByKey(keyInformation, "Total IgE reference range") || "IU/mL",
      delta: "Tracked",
      tone: "var(--clay-ink)",
      tint: "var(--bg-clay-tint)",
    });
  }

  const hb = getByKey(clinicalMeasurements, "Haemoglobin", "Hemoglobin");
  if (hb) {
    kpis.push({
      label: "Haemoglobin",
      value: String(hb).split(" ")[0].replace(/[^\d.]/g, "") || hb,
      sub: "g/dL",
      delta: "Stable",
      tone: "var(--sage-ink)",
      tint: "var(--bg-sage-tint)",
    });
  }

  const eos = getByKey(clinicalMeasurements, "Eosinophils");
  if (eos) {
    kpis.push({
      label: "Eosinophils",
      value: String(eos).split(" ")[0].replace(/[^\d.]/g, "") || eos,
      sub: "×10⁹/L",
      delta: "Monitor",
      tone: "var(--clay-ink)",
      tint: "var(--bg-clay-tint)",
    });
  }

  const severity = getByKey(trendAndRisk, "Severity");
  const trend = getByKey(trendAndRisk, "Trend");
  kpis.push({
    label: "Risk flag",
    value: severity ? severity.split(" ")[0] : "—",
    sub: trend || "based on latest scan",
    delta: trend ? "Noted" : "—",
    tone: "var(--blue-ink)",
    tint: "var(--bg-blue-tint)",
  });

  // Fill to 4 with placeholders if user hasn't got this data
  while (kpis.length < 4) {
    kpis.push({
      label: "—",
      value: "—",
      sub: "Add more data in My Data",
      delta: "",
      tone: "var(--ink-500)",
      tint: "var(--bg-cream)",
    });
  }
  return kpis.slice(0, 4);
}

// ─── Component ──────────────────────────────────────────────────────────

const RANGE_OPTIONS = ["1M", "3M", "6M", "1Y"];

export default function Dashboard() {
  const navigate = useNavigate();
  const [myData, setMyData] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("6M");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyData(), getHealthScanHistory()])
      .then(([data, scans]) => {
        if (!cancelled && data) setMyData(data);
        const count = Array.isArray(scans) ? scans.length : 0;
        if (!cancelled) setScanCount(count);
        if (!cancelled && count === 0 && typeof localStorage !== "undefined") {
          localStorage.removeItem(HEALTH_SCAN_RESULT_KEY);
        }
      })
      .catch(() => {
        if (!cancelled) setMyData(null);
        if (!cancelled) setScanCount(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const keyInformation = myData?.keyInformation || {};
  const patientContext = myData?.patientContext || {};
  const clinicalMeasurements = myData?.clinicalMeasurements || {};
  const trendAndRisk = myData?.trendAndRisk || {};

  const hasData = useMemo(
    () => hasAnyData([keyInformation, patientContext, clinicalMeasurements, trendAndRisk]),
    [keyInformation, patientContext, clinicalMeasurements, trendAndRisk]
  );

  const { radarRows, barRows, lineRows, tableRows, hasData: hasRealCharts } = useMemo(
    () => buildChartData(keyInformation, patientContext, clinicalMeasurements, trendAndRisk),
    [keyInformation, patientContext, clinicalMeasurements, trendAndRisk]
  );

  const kpis = useMemo(
    () => deriveKpis(keyInformation, clinicalMeasurements, trendAndRisk),
    [keyInformation, clinicalMeasurements, trendAndRisk]
  );

  const savedRecs =
    myData?.recommendations &&
    (myData.recommendations.actions ||
      myData.recommendations.diet ||
      myData.recommendations.exercise ||
      myData.recommendations.risks)
      ? myData.recommendations
      : null;
  const localScan = (() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(HEALTH_SCAN_RESULT_KEY) : null;
      if (!raw) return null;
      const data = JSON.parse(raw);
      const rec = data?.recommendations;
      if (rec && (rec.actions || rec.diet || rec.exercise || rec.risks)) return rec;
      return null;
    } catch {
      return null;
    }
  })();
  const displayedRecs = savedRecs || localScan;

  const scanDate = useMemo(() => {
    const d = getByKey(keyInformation, "Report date") ||
      getByKey(keyInformation, "Date") ||
      (myData?.updatedAt ? new Date(myData.updatedAt).toLocaleDateString() : null);
    return d || "your latest scan";
  }, [keyInformation, myData]);

  const filteredTable = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tableRows;
    return tableRows.filter(
      (r) =>
        String(r.label).toLowerCase().includes(q) ||
        String(r.value).toLowerCase().includes(q)
    );
  }, [tableRows, search]);

  return (
    <div style={{ background: "var(--bg-cream)", minHeight: "100vh" }}>
      <Navbar />

      <main className={`${PAGE_MAIN_ROW} max-w-[1400px] pt-[88px]`}>
        <MobileSidebarPanel menuLabel="Workspace">
          <MyDataSidebar activePage="Dashboard" />
        </MobileSidebarPanel>

        <div className="flex-1 min-w-0 w-full">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-end gap-6 mb-6">
            <div>
              <div className="cd-chip mb-3">
                <span className="dot" /> Based on scan from {scanDate}
              </div>
              <h1
                className="mb-1.5"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 40,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  color: "var(--ink-900)",
                }}
              >
                Personal health dashboard
              </h1>
              <p
                className="max-w-[560px] text-sm"
                style={{ color: "var(--ink-500)" }}
              >
                A calm overview of your most recent lab results, how values
                distribute, compare, and trend.
              </p>
            </div>
            <div className="flex gap-2.5">
              <div
                className="flex items-center gap-2 text-sm rounded-[10px]"
                style={{
                  padding: "8px 12px",
                  border: "1px solid var(--line)",
                  background: "var(--bg-white)",
                  color: "var(--ink-700)",
                }}
              >
                <span style={{ color: "var(--ink-500)" }}>Range</span>
                <strong style={{ color: "var(--ink-900)", fontWeight: 500 }}>
                  Last {range === "1M" ? "1 month" : range === "3M" ? "3 months" : range === "6M" ? "6 months" : "year"}
                </strong>
                <ChevronDown size={14} style={{ color: "var(--ink-500)" }} />
              </div>
              <button type="button" className="cd-btn cd-btn-soft">
                <ArrowUpFromLine size={14} /> Export report
              </button>
            </div>
          </div>

          {loading && (
            <div
              className="cd-surface text-center text-sm mb-5"
              style={{ padding: 20, color: "var(--ink-500)" }}
            >
              Loading your data…
            </div>
          )}

          {!loading && (scanCount === 0 || !hasData || !hasRealCharts) && (
            <div
              className="mb-6 text-center"
              style={{
                padding: 20,
                background: "var(--bg-clay-tint)",
                border: "1px solid var(--line-soft)",
                borderRadius: "var(--r-lg)",
              }}
            >
              <p className="font-medium mb-2" style={{ color: "var(--clay-ink)" }}>
                No Health Scan data yet
              </p>
              <p className="text-sm mb-4" style={{ color: "var(--ink-700)" }}>
                Go to <strong>Health Scan</strong>, upload a health record image
                (e.g. lab result, allergy panel), and we'll extract and show the
                information here.
              </p>
              <button
                type="button"
                onClick={() => navigate("/health-scan")}
                className="cd-btn cd-btn-primary"
              >
                Open Health Scan
              </button>
            </div>
          )}

          {!loading && scanCount > 0 && hasData && hasRealCharts && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                {kpis.map((k, i) => (
                  <div key={i} className="cd-kpi">
                    <div className="label">{k.label}</div>
                    <div className="value">{k.value}</div>
                    <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>
                      {k.sub}
                    </div>
                    {k.delta && (
                      <div
                        className="absolute"
                        style={{
                          top: 16,
                          right: 16,
                          padding: "3px 9px",
                          fontSize: 11,
                          fontWeight: 500,
                          background: k.tint,
                          color: k.tone,
                          borderRadius: 999,
                        }}
                      >
                        {k.delta}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Row 1: Radar + Bar */}
              <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-5 mb-5">
                <div className="cd-surface" style={{ padding: 24 }}>
                  <div className="cd-section-title">
                    <div>
                      <h3>Lab & test values</h3>
                      <div className="text-xs mt-0.5" style={{ color: "var(--ink-500)" }}>
                        Radar · relative to reference ranges
                      </div>
                    </div>
                    <span className="hint">Health data only</span>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={radarRows} outerRadius="72%">
                      <PolarGrid stroke="var(--line-soft)" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: "var(--ink-500)", fontSize: 11, fontFamily: "var(--font-sans)" }}
                      />
                      <PolarRadiusAxis stroke="var(--line-soft)" tick={false} axisLine={false} />
                      <Radar
                        name="Value"
                        dataKey="A"
                        stroke="oklch(0.55 0.08 150)"
                        fill="oklch(0.72 0.06 150 / 0.25)"
                        strokeWidth={1.5}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--bg-white)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="cd-surface" style={{ padding: 24 }}>
                  <div className="cd-section-title">
                    <div>
                      <h3>Value comparison</h3>
                      <div className="text-xs mt-0.5" style={{ color: "var(--ink-500)" }}>
                        Bar · absolute measurements
                      </div>
                    </div>
                    <span className="hint">Click a bar for detail</span>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={barRows}
                      margin={{ top: 20, right: 10, left: 0, bottom: 10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 4"
                        stroke="var(--line-soft)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "var(--ink-500)", fontSize: 11, fontFamily: "var(--font-sans)" }}
                        axisLine={{ stroke: "var(--line-soft)" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "var(--ink-500)", fontSize: 11, fontFamily: "var(--font-sans)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--bg-cream)" }}
                        contentStyle={{
                          background: "var(--bg-white)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill="oklch(0.74 0.06 70)"
                        radius={[8, 8, 2, 2]}
                      >
                        <LabelList
                          dataKey="value"
                          position="top"
                          style={{
                            fill: "var(--ink-700)",
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Row 2: Line + AI reco */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5 mb-5">
                <div className="cd-surface" style={{ padding: 24 }}>
                  <div className="cd-section-title">
                    <div>
                      <h3>Trend over time</h3>
                      <div className="text-xs mt-0.5" style={{ color: "var(--ink-500)" }}>
                        Line · values across data points
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {RANGE_OPTIONS.map((r) => (
                        <button
                          type="button"
                          key={r}
                          onClick={() => setRange(r)}
                          style={{
                            padding: "4px 10px",
                            fontSize: 12,
                            borderRadius: 6,
                            background: range === r ? "var(--ink-900)" : "transparent",
                            color: range === r ? "var(--bg-paper)" : "var(--ink-500)",
                            border: range === r ? "none" : "1px solid var(--line)",
                            cursor: "pointer",
                          }}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={230}>
                    <LineChart
                      data={lineRows}
                      margin={{ top: 10, right: 12, left: 0, bottom: 10 }}
                    >
                      <defs>
                        <linearGradient id="d-line-g" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="oklch(0.72 0.05 230 / 0.3)" />
                          <stop offset="100%" stopColor="oklch(0.72 0.05 230 / 0)" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 4" stroke="var(--line-soft)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "var(--ink-500)", fontSize: 11, fontFamily: "var(--font-sans)" }}
                        axisLine={{ stroke: "var(--line-soft)" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "var(--ink-500)", fontSize: 11, fontFamily: "var(--font-sans)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--bg-white)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="oklch(0.42 0.06 230)"
                        strokeWidth={2}
                        dot={{ r: 3.5, fill: "#fff", stroke: "oklch(0.42 0.06 230)", strokeWidth: 2 }}
                        activeDot={{ r: 4.5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div
                  className="cd-surface"
                  style={{
                    padding: 24,
                    background: "var(--bg-sage-tint)",
                    borderColor: "var(--line-soft)",
                  }}
                >
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: "var(--sage-ink)",
                        color: "var(--bg-paper)",
                      }}
                    >
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink-900)" }}>
                        AI-assisted recommendations
                      </h3>
                      <div className="text-[11px]" style={{ color: "var(--ink-500)" }}>
                        Generated from your data · review with your clinician
                      </div>
                    </div>
                  </div>
                  {displayedRecs && (displayedRecs.actions || displayedRecs.diet || displayedRecs.exercise || displayedRecs.risks) ? (
                    <div className="space-y-3">
                      {[
                        ["What to do", displayedRecs.actions],
                        ["Diet", displayedRecs.diet],
                        ["Exercise & activity", displayedRecs.exercise],
                        ["Possible risks", displayedRecs.risks],
                      ].map(
                        ([title, val], i) =>
                          val && (
                            <div
                              key={i}
                              style={{
                                paddingTop: i === 0 ? 12 : 10,
                                borderTop: i === 0 ? "1px solid var(--line-soft)" : "none",
                              }}
                            >
                              <div
                                className="text-[12px] font-semibold uppercase mb-1"
                                style={{
                                  color: "var(--sage-ink)",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                {title}
                              </div>
                              <RecContent value={val} />
                            </div>
                          )
                      )}
                    </div>
                  ) : (
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-700)" }}>
                      Run a Health Scan to get AI-assisted recommendations (what
                      to do, diet, exercise & activity, possible risks). They're
                      generated when you analyze images and saved here.
                    </p>
                  )}
                </div>
              </div>

              {/* Row 3: Summary table */}
              <div className="cd-surface overflow-hidden" style={{ padding: 0 }}>
                <div
                  className="flex flex-wrap items-center justify-between gap-3"
                  style={{
                    padding: "20px 24px",
                    borderBottom: "1px solid var(--line-soft)",
                  }}
                >
                  <div>
                    <h3 className="text-[16px] font-semibold" style={{ color: "var(--ink-900)" }}>
                      My Data summary
                    </h3>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-500)" }}>
                      Every field extracted from your most recent scan.
                    </p>
                  </div>
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute"
                      style={{ left: 10, top: 9, color: "var(--ink-500)" }}
                    />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search fields"
                      style={{
                        padding: "7px 10px 7px 30px",
                        fontSize: 13,
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        background: "var(--bg-paper)",
                        width: 200,
                        outline: "none",
                        color: "var(--ink-900)",
                      }}
                    />
                  </div>
                </div>
                <table className="cd-table">
                  <thead>
                    <tr>
                      <th style={{ width: "40%" }}>Field</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTable.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ textAlign: "center", color: "var(--ink-500)" }}>
                          No matches.
                        </td>
                      </tr>
                    ) : (
                      filteredTable.map((row, i) => (
                        <tr key={i}>
                          <td style={{ color: "var(--ink-500)" }}>{row.label}</td>
                          <td style={{ fontWeight: 500 }}>{row.value}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
