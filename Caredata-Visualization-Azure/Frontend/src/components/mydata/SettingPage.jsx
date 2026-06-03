import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MobileSidebarPanel, { PAGE_MAIN_ROW } from "../common/MobileSidebarPanel";
import { getSettings, saveSettings, changePassword } from "../../services/api";

const SETTINGS_STORAGE_KEY = "caredata_facility_settings";

const STATES = [
  "New South Wales",
  "Victoria",
  "Queensland",
  "South Australia",
  "Western Australia",
  "Tasmania",
  "ACT",
  "Northern Territory",
];

const FACILITY_TYPES = [
  "Residential aged care",
  "Short-term restorative care",
  "Transition care",
];

const RETENTION_OPTIONS = ["12 months", "24 months", "36 months", "Indefinite"];

const BENCHMARKS = [
  { name: "Pressure injuries", value: "5.8%", updated: "Q1 2025" },
  { name: "Restrictive practices", value: "7.2%", updated: "Q1 2025" },
  { name: "Unplanned weight loss", value: "6.1%", updated: "Q1 2025" },
  { name: "Falls & major injury", value: "29.4%", updated: "Q1 2025" },
  { name: "Medications (poly)", value: "32.1%", updated: "Q1 2025" },
  { name: "ADL decline", value: "47.3%", updated: "Q1 2025" },
  { name: "Incontinence (IAD)", value: "4.2%", updated: "Q1 2025" },
  { name: "Hospitalisation", value: "10.8%", updated: "Q1 2025" },
  { name: "Consumer experience", value: "79%", updated: "Q1 2025" },
  { name: "Quality of life", value: "67%", updated: "Q1 2025" },
  { name: "Workforce turnover", value: "18%", updated: "Q1 2025" },
  { name: "Enrolled nursing", value: "—", updated: "Pending" },
  { name: "Allied health", value: "—", updated: "Pending" },
  { name: "Lifestyle officer", value: "—", updated: "Pending" },
];

const SIDEBAR_ITEMS = [
  { id: "facility", label: "Facility profile", icon: "facility" },
  { id: "benchmarks", label: "National benchmarks", icon: "benchmarks" },
  { id: "data", label: "Data retention", icon: "data" },
  { id: "about", label: "About", icon: "about" },
  { id: "password", label: "Change password", icon: "password" },
];

const DEFAULT_FACILITY = {
  facilityName: "",
  facilityRegistration: "",
  napsProviderId: "",
  state: "Queensland",
  facilityType: "Residential aged care",
  bedCapacity: "",
  contactPhone: "",
  contactEmail: "",
  address: "",
  qualityManagerName: "",
  qualityManagerRole: "",
  qualityManagerEmail: "",
  qualityManagerPhone: "",
};

function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-block w-9 h-5 flex-shrink-0 ml-4 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className="block w-full h-5 rounded-full transition-colors"
        style={{ background: checked ? "var(--ink-900)" : "var(--line-strong)" }}
      />
      <span
        className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
        style={{ pointerEvents: "none", background: "var(--bg-white)", boxShadow: "var(--shadow-xs)" }}
      />
    </label>
  );
}

const inputStyle = {
  background: "var(--bg-paper)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  color: "var(--ink-900)",
  fontSize: 14,
  padding: "8px 12px",
  outline: "none",
  width: "100%",
};

export default function SettingPage() {
  const [activeSection, setActiveSection] = useState("facility");
  const [facility, setFacility] = useState(DEFAULT_FACILITY);
  const [benchmarks, setBenchmarks] = useState(BENCHMARKS);
  const [retainHistorical, setRetainHistorical] = useState(true);
  const [autoBackup, setAutoBackup] = useState(true);
  const [retentionPeriod, setRetentionPeriod] = useState("24 months");
  const [savedMsg, setSavedMsg] = useState({ facility: false, benchmarks: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restSettings, setRestSettings] = useState({});
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getSettings()
      .then((data) => {
        if (!cancelled && data && typeof data === "object") {
          const facilityKeys = [
            "facilityName", "facilityRegistration", "napsProviderId", "state", "facilityType",
            "bedCapacity", "contactPhone", "contactEmail", "address", "qualityManagerName",
            "qualityManagerRole", "qualityManagerEmail", "qualityManagerPhone",
          ];
          const rest = {};
          Object.keys(data).forEach((k) => {
            if (!facilityKeys.includes(k)) rest[k] = data[k];
          });
          setRestSettings(rest);
          setFacility((prev) => ({
            ...DEFAULT_FACILITY,
            ...prev,
            facilityName: data.facilityName ?? prev.facilityName,
            facilityRegistration: data.facilityRegistration ?? prev.facilityRegistration,
            napsProviderId: data.napsProviderId ?? prev.napsProviderId,
            state: data.state ?? prev.state,
            facilityType: data.facilityType ?? prev.facilityType,
            bedCapacity: data.bedCapacity ?? prev.bedCapacity,
            contactPhone: data.contactPhone ?? prev.contactPhone,
            contactEmail: data.contactEmail ?? prev.contactEmail,
            address: data.address ?? data.street ?? prev.address,
            qualityManagerName: data.qualityManagerName ?? prev.qualityManagerName,
            qualityManagerRole: data.qualityManagerRole ?? prev.qualityManagerRole,
            qualityManagerEmail: data.qualityManagerEmail ?? prev.qualityManagerEmail,
            qualityManagerPhone: data.qualityManagerPhone ?? prev.qualityManagerPhone,
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          try {
            const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (stored) {
              const parsed = JSON.parse(stored);
              setFacility((prev) => ({ ...DEFAULT_FACILITY, ...prev, ...parsed }));
            }
          } catch {
            // ignore
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleFacilityChange = (key, value) => {
    setFacility((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveFacility = async () => {
    setError("");
    const payload = {
      ...restSettings,
      facilityName: facility.facilityName,
      facilityRegistration: facility.facilityRegistration,
      napsProviderId: facility.napsProviderId,
      state: facility.state,
      facilityType: facility.facilityType,
      bedCapacity: facility.bedCapacity,
      contactPhone: facility.contactPhone,
      contactEmail: facility.contactEmail,
      address: facility.address,
      qualityManagerName: facility.qualityManagerName,
      qualityManagerRole: facility.qualityManagerRole,
      qualityManagerEmail: facility.qualityManagerEmail,
      qualityManagerPhone: facility.qualityManagerPhone,
    };
    try {
      await saveSettings(payload);
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // ignore
      }
      setSavedMsg((prev) => ({ ...prev, facility: true }));
      setTimeout(() => setSavedMsg((p) => ({ ...p, facility: false })), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to save.");
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // ignore
      }
    }
  };

  const handleBenchmarkChange = (index, value) => {
    setBenchmarks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, value } : b))
    );
  };

  const handleSaveBenchmarks = () => {
    setSavedMsg((prev) => ({ ...prev, benchmarks: true }));
    setTimeout(() => setSavedMsg((p) => ({ ...p, benchmarks: false })), 2500);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setPasswordLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Failed to update password.";
      setPasswordError(typeof detail === "string" ? detail : "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar active="Settings" />

      <main className={`${PAGE_MAIN_ROW} pt-32 max-w-[1280px]`}>
        <MobileSidebarPanel menuLabel="Settings">
        <aside className="cd-surface p-4 overflow-y-auto w-full lg:w-60 max-h-[70vh] lg:max-h-[85vh] shrink-0 static lg:sticky lg:top-24">
          <div
            className="mb-3 px-1"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ink-500)",
              textTransform: "uppercase",
              letterSpacing: ".08em",
            }}
          >
            Settings
          </div>
          <ul className="space-y-0.5">
            {SIDEBAR_ITEMS.map((item) => {
              const active = activeSection === item.id;
              return (
                <li
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    background: active ? "var(--ink-900)" : "transparent",
                    color: active ? "var(--bg-white)" : "var(--ink-700)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "var(--bg-paper)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span className="flex-1 min-w-0 truncate">{item.label}</span>
                </li>
              );
            })}
          </ul>
        </aside>
        </MobileSidebarPanel>

        {/* Main content */}
        <div className="flex-1 min-w-0 w-full cd-surface p-4 sm:p-8">
          {loading && activeSection === "facility" && (
            <p className="mb-4" style={{ fontSize: 13, color: "var(--ink-500)" }}>Loading settings…</p>
          )}
          {error && (
            <div
              className="mb-4 p-4"
              style={{
                background: "var(--bg-clay-tint)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                color: "var(--clay-ink)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Facility profile */}
          {activeSection === "facility" && (
            <>
              <h1 className="mb-2" style={{ fontFamily: "var(--font-serif)", fontSize: 30, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>
                <strong>Facility</strong> profile
              </h1>
              <p className="mb-7" style={{ fontSize: 13, color: "var(--ink-500)" }}>
                Basic details about your aged care service. Used across all reports and submissions.
              </p>

              <div className="cd-surface p-6 mb-5">
                <h2 className="mb-1" style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>Service details</h2>
                <p className="mb-5" style={{ fontSize: 13, color: "var(--ink-500)" }}>
                  These details appear on all exported reports and QI submissions.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      Facility name
                    </label>
                    <input
                      type="text"
                      value={facility.facilityName}
                      onChange={(e) => handleFacilityChange("facilityName", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      Facility ID (ACFI)
                    </label>
                    <input
                      type="text"
                      value={facility.facilityRegistration}
                      onChange={(e) => handleFacilityChange("facilityRegistration", e.target.value)}
                      style={inputStyle}
                    />
                    <p className="mt-1" style={{ fontSize: 11, color: "var(--ink-500)" }}>Issued by the Department of Health</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      NAPS provider ID
                    </label>
                    <input
                      type="text"
                      value={facility.napsProviderId}
                      onChange={(e) => handleFacilityChange("napsProviderId", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      State / territory
                    </label>
                    <select
                      value={facility.state}
                      onChange={(e) => handleFacilityChange("state", e.target.value)}
                      style={{ ...inputStyle, background: "var(--bg-white)" }}
                    >
                      {STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      Facility type
                    </label>
                    <select
                      value={facility.facilityType}
                      onChange={(e) => handleFacilityChange("facilityType", e.target.value)}
                      style={{ ...inputStyle, background: "var(--bg-white)" }}
                    >
                      {FACILITY_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      Bed capacity
                    </label>
                    <input
                      type="text"
                      value={facility.bedCapacity}
                      onChange={(e) => handleFacilityChange("bedCapacity", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={facility.contactPhone}
                      onChange={(e) => handleFacilityChange("contactPhone", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={facility.contactEmail}
                      onChange={(e) => handleFacilityChange("contactEmail", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                    Address
                  </label>
                  <input
                    type="text"
                    value={facility.address}
                    onChange={(e) => handleFacilityChange("address", e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="cd-surface p-6 mb-5">
                <h2 className="mb-1" style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>Quality manager</h2>
                <p className="mb-5" style={{ fontSize: 13, color: "var(--ink-500)" }}>
                  Primary contact for QI reporting and compliance queries.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      Full name
                    </label>
                    <input
                      type="text"
                      value={facility.qualityManagerName}
                      onChange={(e) => handleFacilityChange("qualityManagerName", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      Role
                    </label>
                    <input
                      type="text"
                      value={facility.qualityManagerRole}
                      onChange={(e) => handleFacilityChange("qualityManagerRole", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={facility.qualityManagerEmail}
                      onChange={(e) => handleFacilityChange("qualityManagerEmail", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={facility.qualityManagerPhone}
                      onChange={(e) => handleFacilityChange("qualityManagerPhone", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleSaveFacility}
                  disabled={loading}
                  className="cd-btn cd-btn-primary disabled:opacity-50"
                >
                  Save changes
                </button>
                {savedMsg.facility && (
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--sage-ink)" }}>Saved successfully</span>
                )}
              </div>
            </>
          )}

          {/* National benchmarks */}
          {activeSection === "benchmarks" && (
            <>
              <h1 className="mb-2" style={{ fontFamily: "var(--font-serif)", fontSize: 30, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>
                <strong>National</strong> benchmarks
              </h1>
              <p className="mb-7" style={{ fontSize: 13, color: "var(--ink-500)" }}>
                Update national median values from AIHW quarterly reports. These power the Benchmarking page comparisons.
              </p>

              <div className="cd-surface p-6 mb-5">
                <h2 className="mb-1" style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>AIHW national medians</h2>
                <p className="mb-5" style={{ fontSize: 13, color: "var(--ink-500)" }}>
                  Source: GEN Aged Care Data · gen-agedcaredata.gov.au · Update quarterly.
                </p>
                <div
                  className="grid grid-cols-[1fr_120px_120px] gap-3 items-center pb-2 mb-2"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--ink-500)",
                    borderBottom: "1px solid var(--line)",
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                  }}
                >
                  <div>Indicator</div>
                  <div className="text-right">National median</div>
                  <div className="text-right">Last updated</div>
                </div>
                {benchmarks.map((b, i) => (
                  <div
                    key={b.name}
                    className="grid grid-cols-[1fr_120px_120px] gap-3 items-center py-2.5 last:border-0"
                    style={{ borderBottom: "1px solid var(--line-soft)" }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-900)" }}>{b.name}</div>
                    <input
                      type="text"
                      value={b.value}
                      onChange={(e) => handleBenchmarkChange(i, e.target.value)}
                      style={{ ...inputStyle, padding: "6px 10px", textAlign: "right", fontSize: 13 }}
                    />
                    <div className="text-right" style={{ fontSize: 11, color: "var(--ink-400)" }}>{b.updated}</div>
                  </div>
                ))}
                <div
                  className="mt-4 p-3"
                  style={{
                    background: "var(--bg-paper)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: 10,
                    fontSize: 11,
                    color: "var(--ink-500)",
                  }}
                >
                  Download the latest Excel data tables from gen-agedcaredata.gov.au/resources/access-data then update values above each quarter.
                </div>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleSaveBenchmarks}
                  className="cd-btn cd-btn-primary"
                >
                  Save benchmark values
                </button>
                {savedMsg.benchmarks && (
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--sage-ink)" }}>Benchmark values saved</span>
                )}
              </div>
            </>
          )}

          {/* Data retention */}
          {activeSection === "data" && (
            <>
              <h1 className="mb-2" style={{ fontFamily: "var(--font-serif)", fontSize: 30, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>
                <strong>Data</strong> retention
              </h1>
              <p className="mb-7" style={{ fontSize: 13, color: "var(--ink-500)" }}>
                Control how long QI data is stored and manage your data exports.
              </p>

              <div className="cd-surface p-6 mb-5">
                <h2 className="mb-1" style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>Storage settings</h2>
                <p className="mb-5" style={{ fontSize: 13, color: "var(--ink-500)" }}>
                  All data is stored locally in your browser. Nothing is sent to external servers.
                </p>
                <div className="space-y-0" style={{ borderTop: "0" }}>
                  <div className="flex items-center justify-between py-3" style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-900)" }}>Retain historical data</div>
                      <div className="mt-0.5" style={{ fontSize: 11, color: "var(--ink-500)" }}>Keep all past quarters for trend analysis</div>
                    </div>
                    <Toggle checked={retainHistorical} onChange={setRetainHistorical} />
                  </div>
                  <div className="flex items-center justify-between py-3" style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-900)" }}>Auto-backup on upload</div>
                      <div className="mt-0.5" style={{ fontSize: 11, color: "var(--ink-500)" }}>Save a backup copy each time a new CSV is uploaded</div>
                    </div>
                    <Toggle checked={autoBackup} onChange={setAutoBackup} />
                  </div>
                </div>
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                    Data retention period
                  </label>
                  <select
                    value={retentionPeriod}
                    onChange={(e) => setRetentionPeriod(e.target.value)}
                    style={{ ...inputStyle, background: "var(--bg-white)", maxWidth: "20rem" }}
                  >
                    {RETENTION_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <p className="mt-1" style={{ fontSize: 11, color: "var(--ink-500)" }}>Older data will be automatically archived after this period</p>
                </div>
                <div className="flex flex-wrap gap-3 mt-5">
                  <button type="button" className="cd-btn cd-btn-soft">Export all data as CSV</button>
                  <button type="button" className="cd-btn cd-btn-soft">Export full report PDF</button>
                </div>
              </div>

              <div
                className="p-6"
                style={{
                  background: "var(--bg-clay-tint)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-xl)",
                }}
              >
                <h2
                  className="mb-1"
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 20,
                    color: "var(--clay-ink)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Danger zone
                </h2>
                <p className="mb-4" style={{ fontSize: 13, color: "var(--ink-700)" }}>
                  These actions are permanent and cannot be undone.
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    "Clear current quarter data",
                    "Delete all historical data",
                    "Reset facility settings",
                  ].map((label) => (
                    <button
                      key={label}
                      type="button"
                      style={{
                        padding: "10px 18px",
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--clay-ink)",
                        background: "var(--bg-white)",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        cursor: "pointer",
                        transition: "all .15s ease",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Change password */}
          {activeSection === "password" && (
            <>
              <h1 className="mb-2" style={{ fontFamily: "var(--font-serif)", fontSize: 30, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>
                <strong>Change</strong> password
              </h1>
              <p className="mb-7" style={{ fontSize: 13, color: "var(--ink-500)" }}>
                Update your account password. You will stay signed in after saving.
              </p>

              <form onSubmit={handleChangePassword} className="cd-surface p-6 max-w-lg">
                <div className="space-y-4">
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      Current password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      style={inputStyle}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      New password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={inputStyle}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}>
                      Confirm new password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={inputStyle}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {passwordError && (
                  <p className="mt-4 text-sm" style={{ color: "var(--clay-ink)" }}>
                    {passwordError}
                  </p>
                )}
                {passwordSuccess && (
                  <p className="mt-4 text-sm font-medium" style={{ color: "var(--sage-ink)" }}>
                    Password updated successfully.
                  </p>
                )}

                <div className="flex items-center gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="cd-btn cd-btn-primary disabled:opacity-50"
                  >
                    {passwordLoading ? "Updating…" : "Update password"}
                  </button>
                </div>

                <p className="mt-5 text-xs" style={{ color: "var(--ink-500)" }}>
                  Signed in with Google only? Use{" "}
                  <Link to="/forgot-password" className="hover:underline" style={{ color: "var(--sage-ink)", fontWeight: 500 }}>
                    Forgot password
                  </Link>{" "}
                  on the login page to set a password.
                </p>
              </form>
            </>
          )}

          {/* About */}
          {activeSection === "about" && (
            <>
              <h1 className="mb-2" style={{ fontFamily: "var(--font-serif)", fontSize: 30, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>
                <strong>About</strong>
              </h1>
              <p className="mb-7" style={{ fontSize: 13, color: "var(--ink-500)" }}>
                Platform information and regulatory references.
              </p>

              <div className="cd-surface p-6 mb-5">
                <h2 className="mb-1" style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>QI Platform</h2>
                <p className="mb-5" style={{ fontSize: 13, color: "var(--ink-500)" }}>Built for Australian residential aged care providers.</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between" style={{ color: "var(--ink-700)" }}>
                    <span>Version</span>
                    <span className="font-mono" style={{ color: "var(--ink-900)" }}>1.0.0</span>
                  </div>
                  <div className="flex justify-between" style={{ color: "var(--ink-700)" }}>
                    <span>QI Program manual</span>
                    <span>National Mandatory QI Program Manual 4.0</span>
                  </div>
                  <div className="flex justify-between" style={{ color: "var(--ink-700)" }}>
                    <span>Indicators supported</span>
                    <span>14 of 14</span>
                  </div>
                  <div className="flex justify-between" style={{ color: "var(--ink-700)" }}>
                    <span>AIHW benchmark source</span>
                    <span>GEN Aged Care Data, quarterly</span>
                  </div>
                  <div className="flex justify-between" style={{ color: "var(--ink-700)" }}>
                    <span>Regulatory framework</span>
                    <span>Aged Care Act 1997</span>
                  </div>
                  <div className="flex justify-between" style={{ color: "var(--ink-700)" }}>
                    <span>Last benchmark update</span>
                    <span className="font-mono" style={{ color: "var(--ink-900)" }}>Q1 2025 · 27 Jun 2025</span>
                  </div>
                </div>
              </div>

              <div className="cd-surface p-6">
                <h2 className="mb-1" style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)", letterSpacing: "-0.01em" }}>Regulatory references</h2>
                <p className="mb-4" style={{ fontSize: 13, color: "var(--ink-500)" }}>Key documents and links for Australian aged care compliance.</p>
                <div className="flex flex-col gap-2" style={{ fontSize: 13, color: "var(--ink-900)" }}>
                  {[
                    "National Mandatory QI Program Manual 4.0, health.gov.au",
                    "AIHW QI Quarterly Reports, gen-agedcaredata.gov.au",
                    "Aged Care Quality Standards, agedcarequality.gov.au",
                    "Aged Care Act 1997, legislation.gov.au",
                  ].map((line) => (
                    <div
                      key={line}
                      className="p-3"
                      style={{
                        background: "var(--bg-paper)",
                        border: "1px solid var(--line-soft)",
                        borderRadius: 10,
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
