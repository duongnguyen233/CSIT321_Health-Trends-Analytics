import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import MyDataSidebar from "../components/mydata/MyDataSidebar";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { HEALTH_SCAN_RESULT_KEY } from "../constants";
import { getMyData, saveMyData } from "../services/api";

// Initial fake data (will be copied into state so user can edit)
const INITIAL_PATIENT = {
  age: 58,
  sex: "Female",
  knownConditions: "Hypertension, Type 2 diabetes",
  currentMedication: "Metformin 500mg, Lisinopril 10mg",
  height: "165",
  heightUnit: "cm",
  weight: "72",
  weightUnit: "kg",
  bmi: "26.4",
  smokingStatus: "Non-smoker",
  alcoholStatus: "Occasional",
  pregnancyStatus: "",
};
const INITIAL_CLINICAL = {
  bloodPressureSystolic: "128",
  bloodPressureDiastolic: "82",
  heartRate: "76",
  temperature: "36.6",
  oxygenSaturation: "98",
  weight: "72",
  bmi: "26.4",
};
const INITIAL_TREND = {
  recency: "Recent (within 2 weeks)",
  trend: "Stable",
  severity: "Mild (slightly above normal range)",
  abnormalCount: "2",
  symptoms: "None reported",
};

const SEX_OPTIONS = ["Female", "Male", "Prefer not to say"];
const SMOKING_OPTIONS = ["Non-smoker", "Smoker", "Former smoker", "Prefer not to say"];
const ALCOHOL_OPTIONS = ["None", "Occasional", "Moderate", "Heavy", "Prefer not to say"];
const PREGNANCY_OPTIONS = ["", "Not applicable", "Yes", "No", "Prefer not to say"];
const TREND_OPTIONS = ["Stable", "Increasing", "Decreasing", "Unknown"];
const SEVERITY_OPTIONS = [
  "Normal",
  "Mild (slightly above normal range)",
  "Moderate",
  "Severe (far outside normal range)",
  "Unknown",
];

// Row: view mode shows value; edit mode shows input or select
function DataRow({
  label,
  value,
  unknown,
  isEditing,
  type = "text",
  options,
  editValue,
  onChange,
}) {
  const isUnknown = unknown || (value != null && value !== "" ? false : true);
  const display =
    isUnknown ? "Unknown" : Array.isArray(value) ? value.join(", ") : value;

  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-2 py-2 border-b border-gray-100 last:border-0">
        <span className="text-gray-600 text-sm font-medium">{label}</span>
        <span
          className={`text-sm font-medium ${isUnknown ? "text-gray-400 italic" : "text-gray-900"}`}
        >
          {display}
        </span>
      </div>
    );
  }

  // Edit mode
  const val = editValue ?? (isUnknown ? "" : value);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-600 text-sm font-medium shrink-0">{label}</span>
      {type === "number" && (
        <input
          type="number"
          value={val}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      )}
      {type === "select" && (
        <select
          value={val}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-[140px] px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt || "Unknown"}
            </option>
          ))}
        </select>
      )}
      {type === "text" && (
        <input
          type="text"
          value={val}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-[160px] px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      )}
    </div>
  );
}

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

function loadHealthScanResult() {
  try {
    const saved = localStorage.getItem(HEALTH_SCAN_RESULT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        patient: { ...INITIAL_PATIENT, ...(parsed.patient || {}) },
        clinical: { ...INITIAL_CLINICAL, ...(parsed.clinical || {}) },
        trend: { ...INITIAL_TREND, ...(parsed.trend || {}) },
      };
    }
  } catch (_) {}
  return null;
}

export default function MyDataPage() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(INITIAL_PATIENT);
  const [clinical, setClinical] = useState(INITIAL_CLINICAL);
  const [trend, setTrend] = useState(INITIAL_TREND);

  // Load My Data from backend (per user); fallback to localStorage then defaults
  useEffect(() => {
    let cancelled = false;
    getMyData()
      .then((data) => {
        if (cancelled || !data) return;
        const hasPatient = data.patient && Object.keys(data.patient).length > 0;
        const hasClinical = data.clinical && Object.keys(data.clinical).length > 0;
        const hasTrend = data.trend && Object.keys(data.trend).length > 0;
        if (hasPatient || hasClinical || hasTrend) {
          setPatient((p) => ({ ...p, ...(data.patient || {}) }));
          setClinical((c) => ({ ...c, ...(data.clinical || {}) }));
          setTrend((t) => ({ ...t, ...(data.trend || {}) }));
        }
      })
      .catch(() => {
        if (cancelled) return;
        const local = loadHealthScanResult();
        if (local) {
          setPatient((p) => ({ ...p, ...local.patient }));
          setClinical((c) => ({ ...c, ...local.clinical }));
          setTrend((t) => ({ ...t, ...local.trend }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    try {
      await saveMyData({ patient, clinical, trend });
      setIsEditing(false);
    } catch (_) {
      // Still exit edit mode; data remains in state
      setIsEditing(false);
    }
  };

  const patientWeightDisplay = `${patient.weight} ${patient.weightUnit}`;
  const patientHeightDisplay = `${patient.height} ${patient.heightUnit}`;
  const bloodPressureDisplay = `${clinical.bloodPressureSystolic}/${clinical.bloodPressureDiastolic} mmHg`;
  const clinicalWeightDisplay = `${clinical.weight} kg`;

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

          <div className="space-y-6">
            {/* 1) Patient Context */}
            <SectionCard
              title="Patient Context"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            >
              <DataRow
                label="Age"
                value={patient.age}
                isEditing={isEditing}
                type="number"
                editValue={patient.age}
                onChange={(v) => setPatient((p) => ({ ...p, age: v }))}
              />
              <DataRow
                label="Sex"
                value={patient.sex}
                isEditing={isEditing}
                type="select"
                options={SEX_OPTIONS}
                editValue={patient.sex}
                onChange={(v) => setPatient((p) => ({ ...p, sex: v }))}
              />
              <DataRow
                label="Known medical conditions"
                value={patient.knownConditions}
                isEditing={isEditing}
                type="text"
                editValue={patient.knownConditions}
                onChange={(v) => setPatient((p) => ({ ...p, knownConditions: v }))}
              />
              <DataRow
                label="Current medication"
                value={patient.currentMedication}
                isEditing={isEditing}
                type="text"
                editValue={patient.currentMedication}
                onChange={(v) => setPatient((p) => ({ ...p, currentMedication: v }))}
              />
              {!isEditing ? (
                <DataRow label="Height" value={patientHeightDisplay} />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm font-medium">Height</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={patient.height}
                      onChange={(e) => setPatient((p) => ({ ...p, height: e.target.value }))}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary/30"
                    />
                    <select
                      value={patient.heightUnit}
                      onChange={(e) => setPatient((p) => ({ ...p, heightUnit: e.target.value }))}
                      className="px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                    </select>
                  </div>
                </div>
              )}
              {!isEditing ? (
                <DataRow label="Weight" value={patientWeightDisplay} />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm font-medium">Weight</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={patient.weight}
                      onChange={(e) => setPatient((p) => ({ ...p, weight: e.target.value }))}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="text-sm text-gray-500">kg</span>
                  </div>
                </div>
              )}
              <DataRow
                label="BMI"
                value={patient.bmi}
                isEditing={isEditing}
                type="number"
                editValue={patient.bmi}
                onChange={(v) => setPatient((p) => ({ ...p, bmi: v }))}
              />
              <DataRow
                label="Smoking status"
                value={patient.smokingStatus}
                isEditing={isEditing}
                type="select"
                options={SMOKING_OPTIONS}
                editValue={patient.smokingStatus}
                onChange={(v) => setPatient((p) => ({ ...p, smokingStatus: v }))}
              />
              <DataRow
                label="Alcohol status"
                value={patient.alcoholStatus}
                isEditing={isEditing}
                type="select"
                options={ALCOHOL_OPTIONS}
                editValue={patient.alcoholStatus}
                onChange={(v) => setPatient((p) => ({ ...p, alcoholStatus: v }))}
              />
              <DataRow
                label="Pregnancy status (if applicable)"
                value={patient.pregnancyStatus}
                unknown={!patient.pregnancyStatus}
                isEditing={isEditing}
                type="select"
                options={PREGNANCY_OPTIONS}
                editValue={patient.pregnancyStatus}
                onChange={(v) => setPatient((p) => ({ ...p, pregnancyStatus: v }))}
              />
            </SectionCard>

            {/* 2) Clinical Measurements */}
            <SectionCard
              title="Clinical Measurements (Vitals + Lab Results)"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            >
              {!isEditing ? (
                <DataRow label="Blood pressure" value={bloodPressureDisplay} />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm font-medium">Blood pressure</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={clinical.bloodPressureSystolic}
                      onChange={(e) => setClinical((c) => ({ ...c, bloodPressureSystolic: e.target.value }))}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                    <span className="text-gray-500">/</span>
                    <input
                      type="number"
                      value={clinical.bloodPressureDiastolic}
                      onChange={(e) => setClinical((c) => ({ ...c, bloodPressureDiastolic: e.target.value }))}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-500">mmHg</span>
                  </div>
                </div>
              )}
              <DataRow
                label="Heart rate"
                value={clinical.heartRate}
                isEditing={isEditing}
                type="number"
                editValue={clinical.heartRate}
                onChange={(v) => setClinical((c) => ({ ...c, heartRate: v }))}
              />
              <DataRow
                label="Temperature"
                value={clinical.temperature}
                isEditing={isEditing}
                type="number"
                editValue={clinical.temperature}
                onChange={(v) => setClinical((c) => ({ ...c, temperature: v }))}
              />
              <DataRow
                label="Oxygen saturation (SpO₂)"
                value={clinical.oxygenSaturation}
                isEditing={isEditing}
                type="number"
                editValue={clinical.oxygenSaturation}
                onChange={(v) => setClinical((c) => ({ ...c, oxygenSaturation: v }))}
              />
              {!isEditing ? (
                <DataRow label="Weight" value={clinicalWeightDisplay} />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm font-medium">Weight</span>
                  <input
                    type="number"
                    value={clinical.weight}
                    onChange={(e) => setClinical((c) => ({ ...c, weight: e.target.value }))}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
              )}
              <DataRow
                label="BMI"
                value={clinical.bmi}
                isEditing={isEditing}
                type="number"
                editValue={clinical.bmi}
                onChange={(v) => setClinical((c) => ({ ...c, bmi: v }))}
              />
            </SectionCard>

            {/* 3) Trend and Risk Indicators */}
            <SectionCard
              title="Trend and Risk Indicators"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            >
              <DataRow
                label="Recent vs old results (recency)"
                value={trend.recency}
                isEditing={isEditing}
                type="text"
                editValue={trend.recency}
                onChange={(v) => setTrend((t) => ({ ...t, recency: v }))}
              />
              <DataRow
                label="Trend over time"
                value={trend.trend}
                isEditing={isEditing}
                type="select"
                options={TREND_OPTIONS}
                editValue={trend.trend}
                onChange={(v) => setTrend((t) => ({ ...t, trend: v }))}
              />
              <DataRow
                label="Severity (vs normal range)"
                value={trend.severity}
                isEditing={isEditing}
                type="select"
                options={SEVERITY_OPTIONS}
                editValue={trend.severity}
                onChange={(v) => setTrend((t) => ({ ...t, severity: v }))}
              />
              <DataRow
                label="Multiple abnormal results combined"
                value={trend.abnormalCount != null && trend.abnormalCount !== "" ? `${trend.abnormalCount} abnormal` : null}
                unknown={trend.abnormalCount == null || trend.abnormalCount === ""}
                isEditing={isEditing}
                type="number"
                editValue={trend.abnormalCount}
                onChange={(v) => setTrend((t) => ({ ...t, abnormalCount: v }))}
              />
              <DataRow
                label="Symptoms (if available)"
                value={trend.symptoms}
                isEditing={isEditing}
                type="text"
                editValue={trend.symptoms}
                onChange={(v) => setTrend((t) => ({ ...t, symptoms: v }))}
              />
            </SectionCard>
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
              className="bg-orange-500 text-white px-5 py-2 rounded-md font-medium hover:bg-orange-600 transition"
            >
              {isEditing ? "Save" : "Edit Data"}
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
