import { useState, useEffect } from "react";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import { getSettings, saveSettings } from "../../services/api";

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
        className={`block w-full h-5 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-gray-300"
        }`}
      />
      <span
        className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
        style={{ pointerEvents: "none" }}
      />
    </label>
  );
}

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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="Settings" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto gap-6 w-full">
        {/* Sidebar */}
        <aside className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 overflow-y-auto w-56 md:w-60 lg:w-64 max-h-[85vh] shrink-0">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
            Settings
          </div>
          <ul className="space-y-0.5">
            {SIDEBAR_ITEMS.map((item) => (
              <li
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition ${
                  activeSection === item.id
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="flex-1 min-w-0 truncate">{item.label}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow p-8 border border-gray-200">
          {loading && activeSection === "facility" && (
            <p className="text-sm text-gray-500 mb-4">Loading settings…</p>
          )}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Facility profile */}
          {activeSection === "facility" && (
            <>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                <strong>Facility</strong> profile
              </h1>
              <p className="text-sm text-gray-500 mb-7">
                Basic details about your aged care service. Used across all reports and submissions.
              </p>

              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Service details</h2>
                <p className="text-sm text-gray-500 mb-5">
                  These details appear on all exported reports and QI submissions.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Facility name
                    </label>
                    <input
                      type="text"
                      value={facility.facilityName}
                      onChange={(e) => handleFacilityChange("facilityName", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Facility ID (ACFI)
                    </label>
                    <input
                      type="text"
                      value={facility.facilityRegistration}
                      onChange={(e) => handleFacilityChange("facilityRegistration", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Issued by the Department of Health</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      NAPS provider ID
                    </label>
                    <input
                      type="text"
                      value={facility.napsProviderId}
                      onChange={(e) => handleFacilityChange("napsProviderId", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State / territory
                    </label>
                    <select
                      value={facility.state}
                      onChange={(e) => handleFacilityChange("state", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                    >
                      {STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Facility type
                    </label>
                    <select
                      value={facility.facilityType}
                      onChange={(e) => handleFacilityChange("facilityType", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                    >
                      {FACILITY_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bed capacity
                    </label>
                    <input
                      type="text"
                      value={facility.bedCapacity}
                      onChange={(e) => handleFacilityChange("bedCapacity", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={facility.contactPhone}
                      onChange={(e) => handleFacilityChange("contactPhone", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={facility.contactEmail}
                      onChange={(e) => handleFacilityChange("contactEmail", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={facility.address}
                    onChange={(e) => handleFacilityChange("address", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Quality manager</h2>
                <p className="text-sm text-gray-500 mb-5">
                  Primary contact for QI reporting and compliance queries.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={facility.qualityManagerName}
                      onChange={(e) => handleFacilityChange("qualityManagerName", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      value={facility.qualityManagerRole}
                      onChange={(e) => handleFacilityChange("qualityManagerRole", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={facility.qualityManagerEmail}
                      onChange={(e) => handleFacilityChange("qualityManagerEmail", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={facility.qualityManagerPhone}
                      onChange={(e) => handleFacilityChange("qualityManagerPhone", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleSaveFacility}
                  disabled={loading}
                  className="bg-primary text-white text-base font-medium px-6 py-2.5 rounded-lg hover:bg-primary-hover transition disabled:opacity-50"
                >
                  Save changes
                </button>
                {savedMsg.facility && (
                  <span className="text-sm font-medium text-green-600">Saved successfully</span>
                )}
              </div>
            </>
          )}

          {/* National benchmarks */}
          {activeSection === "benchmarks" && (
            <>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                <strong>National</strong> benchmarks
              </h1>
              <p className="text-sm text-gray-500 mb-7">
                Update national median values from AIHW quarterly reports. These power the Benchmarking page comparisons.
              </p>

              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">AIHW national medians</h2>
                <p className="text-sm text-gray-500 mb-5">
                  Source: GEN Aged Care Data · gen-agedcaredata.gov.au · Update quarterly.
                </p>
                <div className="grid grid-cols-[1fr_120px_120px] gap-3 items-center text-sm font-medium text-gray-500 border-b border-gray-200 pb-2 mb-2">
                  <div>Indicator</div>
                  <div className="text-right">National median</div>
                  <div className="text-right">Last updated</div>
                </div>
                {benchmarks.map((b, i) => (
                  <div
                    key={b.name}
                    className="grid grid-cols-[1fr_120px_120px] gap-3 items-center py-2.5 border-b border-gray-100 last:border-0"
                  >
                    <div className="font-medium text-gray-900 text-sm">{b.name}</div>
                    <input
                      type="text"
                      value={b.value}
                      onChange={(e) => handleBenchmarkChange(i, e.target.value)}
                      className="px-2.5 py-1.5 border border-gray-300 rounded-md text-sm text-right text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                    />
                    <div className="text-xs text-gray-400 text-right">{b.updated}</div>
                  </div>
                ))}
                <div className="mt-4 p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-500">
                  Download the latest Excel data tables from gen-agedcaredata.gov.au/resources/access-data then update values above each quarter.
                </div>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleSaveBenchmarks}
                  className="bg-primary text-white text-base font-medium px-6 py-2.5 rounded-lg hover:bg-primary-hover transition"
                >
                  Save benchmark values
                </button>
                {savedMsg.benchmarks && (
                  <span className="text-sm font-medium text-green-600">Benchmark values saved</span>
                )}
              </div>
            </>
          )}

          {/* Data retention */}
          {activeSection === "data" && (
            <>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                <strong>Data</strong> retention
              </h1>
              <p className="text-sm text-gray-500 mb-7">
                Control how long QI data is stored and manage your data exports.
              </p>

              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Storage settings</h2>
                <p className="text-sm text-gray-500 mb-5">
                  All data is stored locally in your browser. Nothing is sent to external servers.
                </p>
                <div className="space-y-0 divide-y divide-gray-100">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Retain historical data</div>
                      <div className="text-xs text-gray-500 mt-0.5">Keep all past quarters for trend analysis</div>
                    </div>
                    <Toggle checked={retainHistorical} onChange={setRetainHistorical} />
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Auto-backup on upload</div>
                      <div className="text-xs text-gray-500 mt-0.5">Save a backup copy each time a new CSV is uploaded</div>
                    </div>
                    <Toggle checked={autoBackup} onChange={setAutoBackup} />
                  </div>
                </div>
                <div className="border-t border-gray-100 mt-4 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data retention period
                  </label>
                  <select
                    value={retentionPeriod}
                    onChange={(e) => setRetentionPeriod(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                  >
                    {RETENTION_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Older data will be automatically archived after this period</p>
                </div>
                <div className="flex flex-wrap gap-3 mt-5">
                  <button type="button" className="bg-[#378add] text-white text-base font-medium px-6 py-2.5 rounded-lg hover:opacity-90 transition">
                    Export all data as CSV
                  </button>
                  <button type="button" className="bg-[#534AB7] text-white text-base font-medium px-6 py-2.5 rounded-lg hover:opacity-90 transition">
                    Export full report PDF
                  </button>
                </div>
              </div>

              <div className="bg-red-50/80 border border-red-200 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-red-800 mb-1">Danger zone</h2>
                <p className="text-sm text-gray-600 mb-4">These actions are permanent and cannot be undone.</p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="bg-white text-red-700 text-base font-medium px-5 py-2.5 rounded-lg border border-red-200 hover:bg-red-50 transition">
                    Clear current quarter data
                  </button>
                  <button type="button" className="bg-white text-red-700 text-base font-medium px-5 py-2.5 rounded-lg border border-red-200 hover:bg-red-50 transition">
                    Delete all historical data
                  </button>
                  <button type="button" className="bg-white text-red-700 text-base font-medium px-5 py-2.5 rounded-lg border border-red-200 hover:bg-red-50 transition">
                    Reset facility settings
                  </button>
                </div>
              </div>
            </>
          )}

          {/* About */}
          {activeSection === "about" && (
            <>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                <strong>About</strong>
              </h1>
              <p className="text-sm text-gray-500 mb-7">
                Platform information and regulatory references.
              </p>

              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">QI Platform</h2>
                <p className="text-sm text-gray-500 mb-5">Built for Australian residential aged care providers.</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Version</span>
                    <span className="font-mono text-gray-900">1.0.0</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>QI Program manual</span>
                    <span>National Mandatory QI Program Manual 4.0</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Indicators supported</span>
                    <span>14 of 14</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>AIHW benchmark source</span>
                    <span>GEN Aged Care Data — quarterly</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Regulatory framework</span>
                    <span>Aged Care Act 1997</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Last benchmark update</span>
                    <span className="font-mono text-gray-900">Q1 2025 · 27 Jun 2025</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Regulatory references</h2>
                <p className="text-sm text-gray-500 mb-4">Key documents and links for Australian aged care compliance.</p>
                <div className="flex flex-col gap-2 text-sm text-gray-900">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    National Mandatory QI Program Manual 4.0 — health.gov.au
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    AIHW QI Quarterly Reports — gen-agedcaredata.gov.au
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    Aged Care Quality Standards — agedcarequality.gov.au
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    Aged Care Act 1997 — legislation.gov.au
                  </div>
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
