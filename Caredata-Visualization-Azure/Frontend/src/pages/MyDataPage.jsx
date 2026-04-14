import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import MyDataSidebar from "../components/mydata/MyDataSidebar";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { HEALTH_SCAN_RESULT_KEY } from "../constants";
import { getMyData, saveMyData, getHealthScanHistory } from "../services/api";

const SECTION_TITLES = {
  keyInformation: "Key information from Health Scan",
  patientContext: "Patient Context",
  clinicalMeasurements: "Clinical Measurements",
  trendAndRisk: "Trend and Risk Indicators",
};

const SECTION_ICONS = {
  keyInformation: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  patientContext: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  clinicalMeasurements: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  trendAndRisk: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
};

function SectionCard({ title, icon, children }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

/** Render a flexible key-value section; supports view and edit (change value, add row, remove row). */
function FlexibleSection({ section, sectionKey, isEditing, onChange }) {
  const entries = isEditing
    ? Object.entries(section || {})
    : Object.entries(section || {}).filter(([, v]) => v != null && String(v).trim() !== "");

  const updateEntry = (label, value) => {
    const next = { ...section };
    if (value === "" || value == null) delete next[label];
    else next[label] = String(value).trim();
    onChange(next);
  };

  const removeEntry = (label) => {
    const next = { ...section };
    delete next[label];
    onChange(next);
  };

  const addRow = () => {
    const newLabel = "New field";
    const next = { ...section, [newLabel]: "" };
    onChange(next);
  };

  if (!isEditing && entries.length === 0) {
    return <p className="text-gray-500 text-sm italic py-2">No information in this section.</p>;
  }

  return (
    <div className="space-y-0">
      {entries.map(([label, value], idx) => (
        <div
          key={`${label}-${idx}`}
          className="flex flex-wrap items-baseline justify-between gap-2 py-2 border-b border-gray-100 last:border-0 group"
        >
          {!isEditing ? (
            <>
              <span className="text-gray-600 text-sm font-medium shrink-0">{label}</span>
              <span className="text-sm font-medium text-gray-900 break-words text-right max-w-[60%]">
                {String(value)}
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  type="text"
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
                  className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="Label"
                />
                <button
                  type="button"
                  onClick={() => removeEntry(label)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                  aria-label="Remove row"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <input
                type="text"
                value={value}
                onChange={(e) => updateEntry(label, e.target.value)}
                className="min-w-[140px] flex-1 max-w-[55%] px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="Value"
              />
            </>
          )}
        </div>
      ))}
      {isEditing && (
        <button
          type="button"
          onClick={addRow}
          className="mt-2 text-sm text-primary font-medium hover:underline flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add row
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
    obj && typeof obj === "object" && Object.values(obj).some((v) => v != null && String(v).trim() !== "");
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
          setClinicalMeasurements(data.clinicalMeasurements || data.clinical || {});
          setTrendAndRisk(data.trendAndRisk || data.trend || {});
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Don't load from localStorage on API error - avoid showing stale data when user has no scans
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
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
    } catch (_) {
      setIsEditing(false);
    }
  };

  const sections = [
    { key: "keyInformation", data: keyInformation, setData: setKeyInformation },
    { key: "patientContext", data: patientContext, setData: setPatientContext },
    { key: "clinicalMeasurements", data: clinicalMeasurements, setData: setClinicalMeasurements },
    { key: "trendAndRisk", data: trendAndRisk, setData: setTrendAndRisk },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto gap-6 w-full">
        <MyDataSidebar activePage="My Data" />

        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3 text-center">
            My Data
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Health insights from your Health Scan. Data is saved to your account.
          </p>

          {loading && (
            <p className="text-center text-gray-500 text-sm mb-4">Loading your data…</p>
          )}

          {!loading &&
            (!hasScans ||
              (!Object.keys(keyInformation).length &&
                !Object.keys(patientContext).length &&
                !Object.keys(clinicalMeasurements).length &&
                !Object.keys(trendAndRisk).length)) && (
              <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <p className="text-amber-800 font-medium mb-2">No data yet</p>
                <p className="text-sm text-amber-700 mb-4">
                  Go to <strong>Health Scan</strong>, upload a health record image (e.g. lab result, allergy panel), and we’ll extract and show the information here.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/health-scan")}
                  className="bg-amber-500 text-white px-4 py-2 rounded-md font-medium hover:bg-amber-600 transition"
                >
                  Open Health Scan
                </button>
              </div>
            )}

          {hasScans && (
          <>
          <div className="space-y-6">
            {sections.map(({ key, data, setData }) => (
              <SectionCard
                key={key}
                title={SECTION_TITLES[key]}
                icon={SECTION_ICONS[key]}
              >
                <FlexibleSection
                  section={data}
                  sectionKey={key}
                  isEditing={isEditing}
                  onChange={setData}
                />
              </SectionCard>
            ))}
          </div>

          <div className="flex justify-center gap-4 mt-10 pt-6 border-t border-gray-200 flex-wrap">
            <button className="bg-white border border-gray-300 px-4 py-2 rounded-md text-gray-700 font-medium hover:bg-gray-100 transition">
              Export as CSV
            </button>
            <button
              onClick={() => navigate("/health-scan")}
              className="bg-white border border-gray-300 px-4 py-2 rounded-md text-gray-700 font-medium hover:bg-gray-100 transition"
            >
              Scan Again
            </button>
            <button
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              className="bg-primary text-white px-5 py-2 rounded-md font-medium hover:bg-primary-hover transition"
            >
              {isEditing ? "Save" : "Edit Data"}
            </button>
          </div>
          </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
