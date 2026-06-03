import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import MyDataSidebar from "../components/mydata/MyDataSidebar";
import MobileSidebarPanel, { PAGE_MAIN_ROW } from "../components/common/MobileSidebarPanel";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  CheckCircle,
  Users,
  Activity,
  Sparkles,
  ArrowUpFromLine,
  Scan,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
} from "../icons/lucideBundle";
import { HEALTH_SCAN_RESULT_KEY } from "../constants";
import { getMyData, saveMyData, getHealthScanHistory } from "../services/api";

const SECTION_META = {
  keyInformation: {
    title: "Key information",
    subtitle: "Extracted from your most recent Health Scan",
    icon: CheckCircle,
    tint: "var(--bg-sage-tint)",
    ink: "var(--sage-ink)",
  },
  patientContext: {
    title: "Patient context",
    subtitle: "Non-clinical information, used for interpretation only",
    icon: Users,
    tint: "var(--bg-clay-tint)",
    ink: "var(--clay-ink)",
  },
  clinicalMeasurements: {
    title: "Clinical measurements",
    subtitle: "Lab values and vitals, the numeric source for your charts",
    icon: Activity,
    tint: "var(--bg-blue-tint)",
    ink: "var(--blue-ink)",
  },
  trendAndRisk: {
    title: "Trend and risk indicators",
    subtitle: "Direction of change and flagged items to discuss",
    icon: Sparkles,
    tint: "var(--bg-sage-tint)",
    ink: "var(--sage-ink)",
  },
};

function formatUpdated(d = new Date()) {
  try {
    return d.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function FlexibleRows({ section, isEditing, onChange }) {
  const entries = isEditing
    ? Object.entries(section || {})
    : Object.entries(section || {}).filter(
        ([, v]) => v != null && String(v).trim() !== ""
      );

  const update = (label, value) => {
    const next = { ...section };
    if (value === "" || value == null) delete next[label];
    else next[label] = String(value).trim();
    onChange(next);
  };
  const remove = (label) => {
    const next = { ...section };
    delete next[label];
    onChange(next);
  };
  const add = () => onChange({ ...section, "New field": "" });

  if (!isEditing && entries.length === 0) {
    return (
      <p
        className="italic text-sm py-1"
        style={{ color: "var(--ink-500)" }}
      >
        No information in this section.
      </p>
    );
  }

  return (
    <div>
      {entries.map(([label, value], i) => (
        <div
          key={`${label}-${i}`}
          className="flex items-baseline justify-between gap-4"
          style={{
            padding: "11px 0",
            borderBottom:
              i === entries.length - 1 ? "none" : "1px solid var(--line-soft)",
          }}
        >
          {!isEditing ? (
            <>
              <span className="text-[13px]" style={{ color: "var(--ink-500)" }}>
                {label}
              </span>
              <span
                className="text-[13.5px] text-right"
                style={{ color: "var(--ink-900)", maxWidth: "65%" }}
              >
                {String(value)}
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  value={label}
                  onChange={(e) => {
                    const newLabel = e.target.value.trim() || label;
                    if (newLabel !== label) {
                      const next = { ...section };
                      next[newLabel] = next[label];
                      delete next[label];
                      onChange(next);
                    }
                  }}
                  className="flex-1 min-w-0 px-2 py-1 text-[13px] rounded"
                  style={{
                    border: "1px solid var(--line)",
                    background: "var(--bg-paper)",
                    color: "var(--ink-900)",
                  }}
                  placeholder="Label"
                />
                <button
                  type="button"
                  onClick={() => remove(label)}
                  className="p-1 rounded transition"
                  style={{ color: "var(--ink-400)" }}
                  aria-label="Remove row"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <input
                value={value}
                onChange={(e) => update(label, e.target.value)}
                className="min-w-[140px] flex-1 max-w-[55%] px-2 py-1 text-[13px] rounded"
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--bg-paper)",
                  color: "var(--ink-900)",
                }}
                placeholder="Value"
              />
            </>
          )}
        </div>
      ))}
      {isEditing && (
        <button
          type="button"
          onClick={add}
          className="mt-3 text-[13px] font-medium flex items-center gap-1.5 transition"
          style={{ color: "var(--sage-ink)" }}
        >
          <Plus size={14} /> Add row
        </button>
      )}
    </div>
  );
}

function loadHealthScanResult() {
  try {
    const saved = localStorage.getItem(HEALTH_SCAN_RESULT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        keyInformation: parsed.keyInformation || {},
        patientContext: parsed.patientContext || parsed.patient || {},
        clinicalMeasurements: parsed.clinicalMeasurements || parsed.clinical || {},
        trendAndRisk: parsed.trendAndRisk || parsed.trend || {},
      };
    }
  } catch (_) {}
  return null;
}

function hasMeaningfulData(data) {
  if (!data || typeof data !== "object") return false;
  const hasVal = (obj) =>
    obj &&
    typeof obj === "object" &&
    Object.values(obj).some((v) => v != null && String(v).trim() !== "");
  return (
    hasVal(data.keyInformation) ||
    hasVal(data.patientContext) ||
    hasVal(data.patient) ||
    hasVal(data.clinicalMeasurements) ||
    hasVal(data.clinical) ||
    hasVal(data.trendAndRisk) ||
    hasVal(data.trend)
  );
}

export default function MyDataPage() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasScans, setHasScans] = useState(false);
  const [keyInformation, setKeyInformation] = useState({});
  const [patientContext, setPatientContext] = useState({});
  const [clinicalMeasurements, setClinicalMeasurements] = useState({});
  const [trendAndRisk, setTrendAndRisk] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyData(), getHealthScanHistory()])
      .then(([data, scans]) => {
        const scanCount = Array.isArray(scans) ? scans.length : 0;
        if (!cancelled) setHasScans(scanCount > 0);
        if (cancelled || scanCount === 0) {
          if (!cancelled && typeof localStorage !== "undefined") {
            localStorage.removeItem(HEALTH_SCAN_RESULT_KEY);
          }
          return;
        }
        if (data && hasMeaningfulData(data)) {
          setKeyInformation(data.keyInformation || {});
          setPatientContext(data.patientContext || data.patient || {});
          setClinicalMeasurements(
            data.clinicalMeasurements || data.clinical || {}
          );
          setTrendAndRisk(data.trendAndRisk || data.trend || {});
          setLastUpdated(
            data.updatedAt ? new Date(data.updatedAt) : new Date()
          );
        }
      })
      .catch(() => {
        /* no-op, don't surface stale data */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    try {
      await saveMyData({
        keyInformation,
        patientContext,
        clinicalMeasurements,
        trendAndRisk,
      });
      setIsEditing(false);
      setLastUpdated(new Date());
    } catch (_) {
      setIsEditing(false);
    }
  };

  // Completion stats
  const allSections = [
    keyInformation,
    patientContext,
    clinicalMeasurements,
    trendAndRisk,
  ];
  const totalFields = allSections.reduce(
    (sum, s) => sum + Object.keys(s || {}).length,
    0
  );
  const filledFields = allSections.reduce(
    (sum, s) =>
      sum +
      Object.values(s || {}).filter(
        (v) => v != null && String(v).trim() !== ""
      ).length,
    0
  );
  const completionPct = totalFields ? Math.round((filledFields / totalFields) * 100) : 0;
  const targetFieldCount = Math.max(totalFields, 21);

  const sectionKeys = [
    { key: "keyInformation", data: keyInformation, set: setKeyInformation },
    { key: "patientContext", data: patientContext, set: setPatientContext },
    {
      key: "clinicalMeasurements",
      data: clinicalMeasurements,
      set: setClinicalMeasurements,
    },
    { key: "trendAndRisk", data: trendAndRisk, set: setTrendAndRisk },
  ];

  const noData =
    !hasScans ||
    (!Object.keys(keyInformation).length &&
      !Object.keys(patientContext).length &&
      !Object.keys(clinicalMeasurements).length &&
      !Object.keys(trendAndRisk).length);

  return (
    <div style={{ background: "var(--bg-cream)", minHeight: "100vh" }}>
      <Navbar />

      <main
        className={`${PAGE_MAIN_ROW} max-w-[1400px] pt-[88px]`}
      >
        <MobileSidebarPanel menuLabel="Workspace">
          <MyDataSidebar activePage="My Data" />
        </MobileSidebarPanel>

        <div className="flex-1 min-w-0 w-full">
          {/* Header */}
          <div className="mb-6">
            <div className="cd-chip mb-3">
              <span className="dot" /> Last updated{" "}
              {lastUpdated ? formatUpdated(lastUpdated) : "—"}
            </div>
            <div className="flex flex-wrap justify-between items-end gap-6">
              <div>
                <h1
                  className="mb-2"
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 42,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                    color: "var(--ink-900)",
                  }}
                >
                  My Data
                </h1>
                <p
                  className="max-w-[560px] text-[14.5px]"
                  style={{ color: "var(--ink-500)" }}
                >
                  A single, editable record of the health information extracted
                  from your scans. Changes here feed directly into your personal
                  dashboard.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  className="cd-btn cd-btn-soft"
                  onClick={() => {
                    /* export stub, existing behaviour preserved below */
                  }}
                >
                  <ArrowUpFromLine size={14} /> Export CSV
                </button>
                <button
                  type="button"
                  className="cd-btn cd-btn-soft"
                  onClick={() => navigate("/health-scan")}
                >
                  <Scan size={14} /> Scan again
                </button>
                <button
                  type="button"
                  className="cd-btn cd-btn-primary"
                  onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
                >
                  {isEditing ? (
                    <>
                      <Save size={14} /> Save
                    </>
                  ) : (
                    <>
                      <Pencil size={14} /> Edit data
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div
              className="cd-surface text-center text-sm mb-6"
              style={{ padding: 20, color: "var(--ink-500)" }}
            >
              Loading your data…
            </div>
          )}

          {/* No-data banner */}
          {!loading && noData && (
            <div
              className="mb-6 text-center"
              style={{
                padding: 20,
                background: "var(--bg-clay-tint)",
                border: "1px solid var(--line-soft)",
                borderRadius: "var(--r-lg)",
              }}
            >
              <p
                className="font-medium mb-2"
                style={{ color: "var(--clay-ink)" }}
              >
                No data yet
              </p>
              <p className="text-sm mb-4" style={{ color: "var(--ink-700)" }}>
                Go to <strong>Health Scan</strong>, upload a health record
                image (e.g. lab result, allergy panel), and we'll extract and
                show the information here.
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

          {!loading && hasScans && !noData && (
            <>
              {/* Completion strip */}
              <div
                className="cd-surface flex flex-wrap items-center gap-5 mb-5"
                style={{ padding: "16px 20px" }}
              >
                <div
                  className="uppercase text-xs"
                  style={{
                    color: "var(--ink-500)",
                    letterSpacing: "0.05em",
                  }}
                >
                  Record completeness
                </div>
                <div
                  className="flex-1"
                  style={{
                    height: 6,
                    background: "var(--bg-cream)",
                    borderRadius: 999,
                    overflow: "hidden",
                    minWidth: 160,
                  }}
                >
                  <div
                    style={{
                      width: `${completionPct}%`,
                      height: "100%",
                      background: "var(--sage)",
                      transition: "width .3s",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 22,
                    color: "var(--ink-900)",
                  }}
                >
                  {completionPct}%
                </div>
                <div className="text-xs" style={{ color: "var(--ink-500)" }}>
                  {filledFields} / {targetFieldCount} fields present
                </div>
              </div>

              {/* 2-column grid of section cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {sectionKeys.map(({ key, data, set }) => {
                  const meta = SECTION_META[key];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={key}
                      className="cd-surface"
                      style={{ padding: 24 }}
                    >
                      <div className="flex gap-3.5 items-start mb-4">
                        <div
                          className="shrink-0 flex items-center justify-center"
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: meta.tint,
                            color: meta.ink,
                          }}
                        >
                          <Icon size={18} />
                        </div>
                        <div>
                          <h3
                            className="text-[16px] font-semibold"
                            style={{ color: "var(--ink-900)" }}
                          >
                            {meta.title}
                          </h3>
                          <p
                            className="text-[12.5px] mt-0.5"
                            style={{ color: "var(--ink-500)" }}
                          >
                            {meta.subtitle}
                          </p>
                        </div>
                      </div>
                      <FlexibleRows
                        section={data}
                        isEditing={isEditing}
                        onChange={set}
                      />
                    </div>
                  );
                })}
              </div>

              {isEditing && (
                <div className="mt-6 flex justify-end gap-2.5">
                  <button
                    type="button"
                    className="cd-btn cd-btn-ghost"
                    onClick={() => setIsEditing(false)}
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button
                    type="button"
                    className="cd-btn cd-btn-primary"
                    onClick={handleSave}
                  >
                    <Save size={14} /> Save changes
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
