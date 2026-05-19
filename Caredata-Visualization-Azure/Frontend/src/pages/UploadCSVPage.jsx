import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { uploadAndAnalyzeCSV, getUploadHistory, downloadUploadCSV, deleteUpload, api, getGPMSList, getGPMSByDate, saveGPMS } from "../services/api";
import * as XLSX from "xlsx";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_SIZE_MB = 5;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;
const SELECTED_UPLOAD_KEY = "caredata_selected_upload_id";

const UPLOAD_PROGRESS_ESTIMATE_MS = 45000;
const UPLOAD_PROGRESS_TICK_MS = 400;

function formatUploadDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// ─── GPMS Section 1 Field Definitions ────────────────────────────────────────
// Matches government template Section 1 fields exactly (the aggregate values
// entered into GPMS). 13 sheets in gov template = 13 sections below.
// Each field: { key, label, type: "int"|"date", required? }

const GPMS_SECTIONS = [
  {
    id: "pi", qiNum: 1, title: "Pressure injuries",
    desc: "Percentage of individuals with one or more pressure injuries, reported against six stages",
    fields: [
      { key: "pi_total", label: "Total individuals assessed", type: "int", required: true },
      { key: "pi_excl_consent", label: "Excluded, withheld consent", type: "int" },
      { key: "pi_excl_absent", label: "Excluded, absent entire period", type: "int" },
      { key: "pi_any", label: "Individuals with ≥1 PI (any stage)", type: "int", required: true },
      { key: "pi_s1", label: "Stage 1 Pressure Injury", type: "int" },
      { key: "pi_s2", label: "Stage 2 Pressure Injury", type: "int" },
      { key: "pi_s3", label: "Stage 3 Pressure Injury", type: "int" },
      { key: "pi_s4", label: "Stage 4 Pressure Injury", type: "int" },
      { key: "pi_unstage", label: "Unstageable Pressure Injury", type: "int" },
      { key: "pi_dti", label: "Suspected Deep Tissue Injury", type: "int" },
      { key: "pi_acq_outside", label: "PIs acquired outside service", type: "int" },
      { key: "pi_acq_outside_s1", label: "Acquired outside, Stage 1", type: "int" },
      { key: "pi_acq_outside_s2", label: "Acquired outside, Stage 2", type: "int" },
      { key: "pi_acq_outside_s3", label: "Acquired outside, Stage 3", type: "int" },
      { key: "pi_acq_outside_s4", label: "Acquired outside, Stage 4", type: "int" },
      { key: "pi_acq_outside_unstage", label: "Acquired outside, Unstageable", type: "int" },
      { key: "pi_acq_outside_dti", label: "Acquired outside, Suspected DTI", type: "int" },
    ],
  },
  {
    id: "rp", qiNum: 2, title: "Restrictive practices",
    desc: "Percentage of individuals subject to the use of a restrictive practice (excl. chemical restraint)",
    fields: [
      { key: "rp_date_start", label: "3-day collection period start date", type: "date" },
      { key: "rp_date_end", label: "3-day collection period end date", type: "date" },
      { key: "rp_total", label: "Total individuals assessed", type: "int", required: true },
      { key: "rp_excl_absent", label: "Excluded, absent entire period", type: "int" },
      { key: "rp_any", label: "Individuals subject to any RP", type: "int", required: true },
      { key: "rp_secure_only", label: "RP exclusively via secure area", type: "int" },
    ],
  },
  {
    id: "uwl", qiNum: 3, title: "Unplanned weight loss",
    desc: "Significant (≥5%) and consecutive unplanned weight loss",
    fields: [
      { key: "uwl_total_sig", label: "Total assessed, significant UWL", type: "int", required: true },
      { key: "uwl_total_con", label: "Total assessed, consecutive UWL", type: "int", required: true },
      { key: "uwl_excl_consent_sig", label: "Significant: excluded, withheld consent (finishing weight)", type: "int" },
      { key: "uwl_excl_consent_con", label: "Consecutive: excluded, withheld consent (any weight date)", type: "int" },
      { key: "uwl_excl_eol", label: "Excluded, end-of-life care", type: "int" },
      { key: "uwl_excl_weights_sig", label: "Significant: excluded, missing previous or finishing weight", type: "int" },
      { key: "uwl_excl_weights_con", label: "Consecutive: excluded, missing required weights", type: "int" },
      { key: "uwl_sig", label: "Individuals with significant UWL (≥5%)", type: "int", required: true },
      { key: "uwl_con", label: "Individuals with consecutive UWL", type: "int", required: true },
    ],
  },
  {
    id: "falls", qiNum: 4, title: "Falls and major injury",
    desc: "Falls experienced and falls resulting in major injury",
    fields: [
      { key: "falls_total", label: "Total individuals assessed", type: "int", required: true },
      { key: "falls_excl_absent", label: "Excluded, absent entire period", type: "int" },
      { key: "falls_any", label: "Individuals with ≥1 fall", type: "int", required: true },
      { key: "falls_major", label: "Individuals with fall + major injury", type: "int", required: true },
    ],
  },
  {
    id: "meds_poly", qiNum: 5, title: "Medication management, Polypharmacy",
    desc: "Percentage of individuals prescribed nine or more medications",
    fields: [
      { key: "poly_date", label: "Collection date", type: "date" },
      { key: "poly_total", label: "Total individuals assessed", type: "int", required: true },
      { key: "poly_excl_hospital", label: "Excluded, admitted in hospital on collection date", type: "int" },
      { key: "poly_count", label: "Individuals prescribed ≥9 medications", type: "int", required: true },
    ],
  },
  {
    id: "meds_ap", qiNum: 5, title: "Medication management, Antipsychotics",
    desc: "Percentage of individuals who received antipsychotic medications",
    fields: [
      { key: "ap_date", label: "7-day collection period end date", type: "date" },
      { key: "ap_total", label: "Total individuals assessed", type: "int", required: true },
      { key: "ap_excl_hospital", label: "Excluded, in hospital ≥6 days prior", type: "int" },
      { key: "ap_any", label: "Individuals who received an antipsychotic", type: "int", required: true },
      { key: "ap_with_dx", label: "Antipsychotic with psychosis diagnosis", type: "int", required: true },
    ],
  },
  {
    id: "adl", qiNum: 6, title: "Activities of daily living",
    desc: "Percentage of individuals who experienced a decline in ADL (Barthel Index)",
    fields: [
      { key: "adl_total", label: "Total individuals assessed", type: "int", required: true },
      { key: "adl_excl_eol", label: "Excluded, end-of-life care", type: "int" },
      { key: "adl_excl_absent", label: "Excluded, absent entire period", type: "int" },
      { key: "adl_excl_no_prior", label: "Excluded, no prior ADL score", type: "int" },
      { key: "adl_zero_prior", label: "Individuals with zero prior score", type: "int" },
      { key: "adl_decline", label: "Individuals with ADL decline (≥1 point)", type: "int", required: true },
    ],
  },
  {
    id: "ic", qiNum: 7, title: "Incontinence care",
    desc: "Percentage of individuals who experienced Incontinence Associated Dermatitis (IAD)",
    fields: [
      { key: "ic_total", label: "Total individuals assessed", type: "int", required: true },
      { key: "ic_excl_absent", label: "Excluded, absent entire period", type: "int" },
      { key: "ic_excl_no_incont", label: "Excluded, no incontinence (not assessed for IAD)", type: "int" },
      { key: "ic_incontinence", label: "Individuals with incontinence", type: "int", required: true },
      { key: "ic_iad_any", label: "Individuals with incontinence and IAD", type: "int", required: true },
      { key: "ic_iad_1a", label: "IAD Cat 1A, persistent redness, no infection", type: "int" },
      { key: "ic_iad_1b", label: "IAD Cat 1B, persistent redness, with infection", type: "int" },
      { key: "ic_iad_2a", label: "IAD Cat 2A, skin loss, no infection", type: "int" },
      { key: "ic_iad_2b", label: "IAD Cat 2B, skin loss, with infection", type: "int" },
    ],
  },
  {
    id: "hosp", qiNum: 8, title: "Hospitalisation",
    desc: "ED presentations and hospital admissions",
    fields: [
      { key: "hosp_total", label: "Total individuals assessed", type: "int", required: true },
      { key: "hosp_excl_absent", label: "Excluded, absent entire period", type: "int" },
      { key: "hosp_ed", label: "Individuals with ≥1 ED presentation", type: "int", required: true },
      { key: "hosp_all", label: "Individuals with ≥1 ED or hospital admission", type: "int", required: true },
    ],
  },
  {
    id: "wf", qiNum: 9, title: "Workforce",
    desc: "Staff turnover, headcounts by role across 3 steps",
    fields: [
      { key: "wf_s1_mgr", label: "Step 1, Service managers (worked any hrs last period)", type: "int" },
      { key: "wf_s1_rn", label: "Step 1, RNs / NPs (worked any hrs last period)", type: "int" },
      { key: "wf_s1_en", label: "Step 1, ENs (worked any hrs last period)", type: "int" },
      { key: "wf_s1_pcw", label: "Step 1, PCW / AINs (worked any hrs last period)", type: "int" },
      { key: "wf_s2_mgr", label: "Step 2, Service managers (≥120 hrs, employed at start)", type: "int" },
      { key: "wf_s2_rn", label: "Step 2, RNs / NPs (≥120 hrs, employed at start)", type: "int" },
      { key: "wf_s2_en", label: "Step 2, ENs (≥120 hrs, employed at start)", type: "int" },
      { key: "wf_s2_pcw", label: "Step 2, PCW / AINs (≥120 hrs, employed at start)", type: "int" },
      { key: "wf_s3_mgr", label: "Step 3, Service managers stopped (≥60-day gap)", type: "int" },
      { key: "wf_s3_rn", label: "Step 3, RNs / NPs stopped (≥60-day gap)", type: "int" },
      { key: "wf_s3_en", label: "Step 3, ENs stopped (≥60-day gap)", type: "int" },
      { key: "wf_s3_pcw", label: "Step 3, PCW / AINs stopped (≥60-day gap)", type: "int" },
    ],
  },
  {
    id: "cx", qiNum: 10, title: "Consumer experience",
    desc: "QoCE-ACC assessment, completion methods and score bands",
    fields: [
      { key: "cx_completed_self", label: "Completed, self-completion", type: "int" },
      { key: "cx_completed_interview", label: "Completed, interviewer facilitated", type: "int" },
      { key: "cx_completed_proxy", label: "Completed, proxy", type: "int" },
      { key: "cx_excl_absent", label: "Excluded, absent", type: "int" },
      { key: "cx_excl_optout", label: "Excluded, opted out", type: "int" },
      { key: "cx_excellent", label: "Score band: Excellent (22–24)", type: "int" },
      { key: "cx_good", label: "Score band: Good (19–21)", type: "int" },
      { key: "cx_moderate", label: "Score band: Moderate (14–18)", type: "int" },
      { key: "cx_poor", label: "Score band: Poor (8–13)", type: "int" },
      { key: "cx_very_poor", label: "Score band: Very poor (0–7)", type: "int" },
    ],
  },
  {
    id: "qol", qiNum: 11, title: "Quality of life",
    desc: "QoL-ACC assessment, completion methods and score bands",
    fields: [
      { key: "qol_completed_self", label: "Completed, self-completion", type: "int" },
      { key: "qol_completed_interview", label: "Completed, interviewer facilitated", type: "int" },
      { key: "qol_completed_proxy", label: "Completed, proxy", type: "int" },
      { key: "qol_excl_absent", label: "Excluded, absent", type: "int" },
      { key: "qol_excl_optout", label: "Excluded, opted out", type: "int" },
      { key: "qol_excellent", label: "Score band: Excellent (22–24)", type: "int" },
      { key: "qol_good", label: "Score band: Good (19–21)", type: "int" },
      { key: "qol_moderate", label: "Score band: Moderate (14–18)", type: "int" },
      { key: "qol_poor", label: "Score band: Poor (8–13)", type: "int" },
      { key: "qol_very_poor", label: "Score band: Very poor (0–7)", type: "int" },
    ],
  },
  {
    id: "ah", qiNum: 13, title: "Allied health",
    desc: "Recommended vs received allied health services by discipline",
    fields: [
      { key: "ah_total", label: "Total individuals assessed", type: "int", required: true },
      { key: "ah_excl_absent", label: "Excluded, absent entire period", type: "int" },
      { key: "ah_rec_physio", label: "Physiotherapy, recommended", type: "int" },
      { key: "ah_rcv_physio", label: "Physiotherapy, received", type: "int" },
      { key: "ah_rec_ot", label: "Occupational therapy, recommended", type: "int" },
      { key: "ah_rcv_ot", label: "Occupational therapy, received", type: "int" },
      { key: "ah_rec_speech", label: "Speech pathology, recommended", type: "int" },
      { key: "ah_rcv_speech", label: "Speech pathology, received", type: "int" },
      { key: "ah_rec_pod", label: "Podiatry, recommended", type: "int" },
      { key: "ah_rcv_pod", label: "Podiatry, received", type: "int" },
      { key: "ah_rec_diet", label: "Dietetics, recommended", type: "int" },
      { key: "ah_rcv_diet", label: "Dietetics, received", type: "int" },
      { key: "ah_rec_assist", label: "AH assistants, recommended", type: "int" },
      { key: "ah_rcv_assist", label: "AH assistants, received", type: "int" },
      { key: "ah_rec_other", label: "Other allied health, recommended", type: "int" },
      { key: "ah_rcv_other", label: "Other allied health, received", type: "int" },
    ],
  },
];

const ALL_FIELD_KEYS = GPMS_SECTIONS.flatMap(s => s.fields.map(f => f.key));
const REQUIRED_KEYS = GPMS_SECTIONS.flatMap(s => s.fields.filter(f => f.required).map(f => f.key));

// ─── Sidebar items ───────────────────────────────────────────────────────────

const SIDEBAR_ITEMS = [
  {
    id: "upload", label: "Upload Data",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    id: "manual", label: "Manual Entry",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    id: "download", label: "Download",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
];

// ─── Excel export helper ─────────────────────────────────────────────────────

function buildGovTemplateWorkbook(formData) {
  const wb = XLSX.utils.book_new();

  GPMS_SECTIONS.forEach(section => {
    const header = ["Field", "Value"];
    const rows = section.fields.map(f => {
      const val = formData[f.key];
      return [f.label, val != null && val !== "" ? (f.type === "int" ? Number(val) : val) : ""];
    });
    const ws = XLSX.utils.aoa_to_sheet([
      [section.title.toUpperCase()],
      [`QI ${section.qiNum}, ${section.desc}`],
      [],
      ["DATA FOR GPMS REPORTING"],
      header,
      ...rows,
    ]);
    ws["!cols"] = [{ wch: 60 }, { wch: 20 }];
    const sheetName = section.title.length > 31 ? section.title.slice(0, 31) : section.title;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  return wb;
}

function downloadWorkbook(wb, filename) {
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UploadCSVPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState("upload");

  // Upload state
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedUploadId, setSelectedUploadId] = useState(() => localStorage.getItem(SELECTED_UPLOAD_KEY) || "");
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // GPMS form state
  const [formData, setFormData] = useState({});
  const [prefilledKeys, setPrefilledKeys] = useState(new Set());
  const [expandedSections, setExpandedSections] = useState(new Set(["pi"]));
  const [gpmsFromUpload, setGpmsFromUpload] = useState(null); // { dateKey: {field: value} }
  const [selectedGpmsDate, setSelectedGpmsDate] = useState("");
  const [uploadFlagSummary, setUploadFlagSummary] = useState(null); // { filled, unfilled, total }
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [gpmsDates, setGpmsDates] = useState([]); // available GPMS dates from server
  const [gpmsSaving, setGpmsSaving] = useState(false);
  const saveTimerRef = useRef(null);

  // Load GPMS dates from server on mount
  useEffect(() => {
    (async () => {
      try {
        const resp = await getGPMSList();
        const subs = resp?.submissions || [];
        const dates = subs.map(s => s.date || s.assessmentDate).filter(Boolean).sort();
        setGpmsDates(dates);
        // If no date selected yet and server has dates, select latest
        if (dates.length > 0 && !selectedGpmsDate) {
          const latest = dates[dates.length - 1];
          setSelectedGpmsDate(latest);
        }
      } catch (err) {
        console.warn("GPMS: failed to load dates from server", err);
      }
    })();
  }, []);

  // Load form data from server when selectedGpmsDate changes
  useEffect(() => {
    if (!selectedGpmsDate) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await getGPMSByDate(selectedGpmsDate);
        if (cancelled) return;
        const serverData = resp?.formData || {};
        // Only apply server data if form is currently empty or we're switching dates
        if (Object.keys(serverData).length > 0) {
          setFormData(serverData);
          setPrefilledKeys(new Set(Object.keys(serverData).filter(k => serverData[k] != null && serverData[k] !== "")));
        }
      } catch {
        // 404 = no saved data for this date, that's fine
      }
    })();
    return () => { cancelled = true; };
  }, [selectedGpmsDate]);

  // Debounced save to server when form data changes
  useEffect(() => {
    if (!selectedGpmsDate || Object.keys(formData).length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setGpmsSaving(true);
        await saveGPMS(selectedGpmsDate, formData, false);
      } catch (err) {
        console.warn("GPMS: failed to save to server", err);
      } finally {
        setGpmsSaving(false);
      }
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [formData, selectedGpmsDate]);

  const setSelected = (uploadId) => {
    if (uploadId) localStorage.setItem(SELECTED_UPLOAD_KEY, uploadId);
    else localStorage.removeItem(SELECTED_UPLOAD_KEY);
    setSelectedUploadId(uploadId || "");
  };

  const loadHistory = () => {
    getUploadHistory()
      .then((list) => setHistory(Array.isArray(list) ? list : []))
      .catch(() => setHistory([]));
  };

  useEffect(() => { loadHistory(); }, []);

  // ─── Upload handlers ────────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setError("");
    setResult(null);
    setUploadFlagSummary(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && f.name.toLowerCase().endsWith(".csv")) setFile(f);
    setError("");
    setResult(null);
    setUploadFlagSummary(null);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError("Please select a CSV file first."); return; }
    if (file.size > MAX_BYTES) { setError(`File must be under ${MAX_SIZE_MB} MB.`); return; }
    setUploading(true);
    setUploadProgress(0);
    setError("");
    setResult(null);
    setUploadFlagSummary(null);
    const increment = 100 / (UPLOAD_PROGRESS_ESTIMATE_MS / UPLOAD_PROGRESS_TICK_MS);
    const progressTimer = setInterval(() => {
      setUploadProgress((p) => (p >= 90 ? p : Math.min(p + increment, 90)));
    }, UPLOAD_PROGRESS_TICK_MS);
    try {
      const data = await uploadAndAnalyzeCSV(file);
      clearInterval(progressTimer);
      setUploadProgress(100);
      setResult(data);
      loadHistory();

      // Process GPMS fields from response
      if (data?.gpmsFields && Object.keys(data.gpmsFields).length > 0) {
        setGpmsFromUpload(data.gpmsFields);
        const dates = Object.keys(data.gpmsFields).sort();
        const latestDate = dates[dates.length - 1] || "";
        setSelectedGpmsDate(latestDate);
        setPrefillApplied(false);
        // Update available GPMS dates
        setGpmsDates(prev => [...new Set([...prev, ...dates])].sort());
        // Count filled vs unfilled
        if (latestDate && data.gpmsFields[latestDate]) {
          const vals = data.gpmsFields[latestDate];
          const filled = ALL_FIELD_KEYS.filter(k => vals[k] != null && vals[k] !== "").length;
          setUploadFlagSummary({ filled, unfilled: ALL_FIELD_KEYS.length - filled, total: ALL_FIELD_KEYS.length });

          // Auto-apply prefill to form immediately
          const newForm = {};
          const filledKeys = new Set();
          for (const key of ALL_FIELD_KEYS) {
            if (vals[key] != null && vals[key] !== "") {
              newForm[key] = String(vals[key]);
              filledKeys.add(key);
            }
          }
          setFormData(newForm);
          setPrefilledKeys(filledKeys);
          setPrefillApplied(true);
        }
      }

      setTimeout(() => { setUploading(false); setUploadProgress(0); }, 400);
    } catch (err) {
      clearInterval(progressTimer);
      setUploadProgress(0);
      setUploading(false);
      const detail = err.response?.data?.detail;
      const msg = detail != null
        ? (Array.isArray(detail) ? detail.join(" ") : String(detail))
        : (err.message || "Upload failed.");
      setError(msg);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError("");
    setResult(null);
    setUploadFlagSummary(null);
    const el = document.getElementById("file-input");
    if (el) el.value = "";
  };

  const handleDownload = async (uploadId, filename) => {
    if (downloadingId) return;
    setDownloadingId(uploadId);
    try { await downloadUploadCSV(uploadId, filename || "data.csv"); }
    catch (err) { console.error("Download failed:", err); }
    finally { setDownloadingId(null); }
  };

  const handleDelete = async (item) => {
    if (deletingId) return;
    if (!window.confirm(`Delete "${item.filename || item.uploadId}"? This cannot be undone.`)) return;
    setDeletingId(item.uploadId);
    try {
      await deleteUpload(item.uploadId);
      if (selectedUploadId === item.uploadId) setSelected("");
      loadHistory();
    } catch (err) { console.error("Delete failed:", err); }
    finally { setDeletingId(null); }
  };

  // ─── Pre-fill from CSV → Manual Entry ───────────────────────────────────

  const applyPrefill = (switchTab = true) => {
    if (!gpmsFromUpload || !selectedGpmsDate) return;
    const vals = gpmsFromUpload[selectedGpmsDate] || {};
    const newForm = { ...formData };
    const filled = new Set();
    for (const key of ALL_FIELD_KEYS) {
      if (vals[key] != null && vals[key] !== "") {
        newForm[key] = String(vals[key]);
        filled.add(key);
      }
    }
    setFormData(newForm);
    setPrefilledKeys(filled);
    setPrefillApplied(true);
    if (switchTab) {
      setActiveTab("manual");
      setExpandedSections(new Set(GPMS_SECTIONS.map(s => s.id)));
    }
  };

  // Auto-apply prefill when switching to manual tab if GPMS data is available
  const handleTabSwitch = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "manual" && gpmsFromUpload && selectedGpmsDate && !prefillApplied) {
      applyPrefill(false);
      setExpandedSections(new Set(GPMS_SECTIONS.map(s => s.id)));
    }
  };

  // ─── Form handlers ─────────────────────────────────────────────────────

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const clearForm = () => {
    if (!window.confirm("Clear all form data? This cannot be undone.")) return;
    setFormData({});
    setPrefilledKeys(new Set());
    // Save empty form to server
    if (selectedGpmsDate) {
      saveGPMS(selectedGpmsDate, {}, false).catch(() => {});
    }
  };

  // ─── Excel export ───────────────────────────────────────────────────────

  const handleExportExcel = () => {
    const wb = buildGovTemplateWorkbook(formData);
    downloadWorkbook(wb, "QI_GPMS_Submission.xlsx");
  };

  // ─── Download gov template ──────────────────────────────────────────────

  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const handleDownloadGovTemplate = () => {
    const a = document.createElement("a");
    a.href = "/qi-program-data-recording-templates.xlsx";
    a.download = "qi-program-data-recording-templates.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ─── Completion stats ───────────────────────────────────────────────────

  const filledCount = ALL_FIELD_KEYS.filter(k => formData[k] != null && formData[k] !== "").length;
  const requiredFilledCount = REQUIRED_KEYS.filter(k => formData[k] != null && formData[k] !== "").length;

  // ─── Sidebar ────────────────────────────────────────────────────────────

  const sidebar = (
    <aside
      className="shrink-0 w-60 self-start sticky top-24"
      style={{
        background: "var(--bg-white)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: "16px 12px",
      }}
    >
      <p
        className="uppercase mb-3 px-3"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "var(--ink-500)",
        }}
      >
        Data entry
      </p>
      <ul className="space-y-0.5">
        {SIDEBAR_ITEMS.map(item => {
          const isActive = activeTab === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleTabSwitch(item.id)}
                className="w-full flex items-center gap-2.5 transition text-left"
                style={{
                  padding: "9px 12px",
                  fontSize: 14,
                  borderRadius: 10,
                  color: isActive ? "var(--ink-900)" : "var(--ink-700)",
                  background: isActive ? "var(--bg-sage-tint)" : "transparent",
                  fontWeight: isActive ? 500 : 400,
                  boxShadow: isActive ? "inset 0 0 0 1px var(--sage)" : "none",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-cream)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ color: isActive ? "var(--sage-ink)" : "var(--ink-500)" }}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {(activeTab === "manual" || activeTab === "download") && (
        <div className="mt-4 px-3 pt-3" style={{ borderTop: "1px solid var(--line-soft)" }}>
          <p
            className="text-[11px] uppercase mb-2"
            style={{ color: "var(--ink-500)", fontWeight: 600, letterSpacing: "0.08em" }}
          >
            Form progress
          </p>
          <div
            className="w-full rounded-full h-1.5 mb-2"
            style={{ background: "var(--bg-cream)", border: "1px solid var(--line-soft)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${ALL_FIELD_KEYS.length ? (filledCount / ALL_FIELD_KEYS.length) * 100 : 0}%`,
                background: "var(--sage)",
              }}
            />
          </div>
          <p className="text-xs" style={{ color: "var(--ink-500)" }}>
            {filledCount} / {ALL_FIELD_KEYS.length} fields
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-500)" }}>
            {requiredFilledCount} / {REQUIRED_KEYS.length} required
          </p>
        </div>
      )}
    </aside>
  );

  // ─── Upload tab ─────────────────────────────────────────────────────────

  const uploadTab = (
    <div className="flex-1 min-w-0 space-y-6">
      {/* Header */}
      <div>
        <span className="cd-chip mb-2" style={{ display: "inline-flex" }}>
          <span className="dot" /> Quarterly intake
        </span>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 30,
            color: "var(--ink-900)",
            letterSpacing: "-0.01em",
            marginTop: 8,
            marginBottom: 4,
          }}
        >
          Upload QI data
        </h1>
        <p style={{ color: "var(--ink-500)", fontSize: 14 }}>
          Upload your quarterly CSV from the QI Platform template. Data will be validated and GPMS fields auto-computed.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 items-start">
        {/* LEFT: Upload card */}
        <div className="cd-surface overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--line-soft)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-900)" }}>Quarterly CSV upload</h2>
            <p className="mt-1" style={{ fontSize: 13, color: "var(--ink-500)" }}>
              Accepted: .csv files, GPMS export or QI Platform template
            </p>
          </div>

          {/* Drop zone */}
          <div
            className="mx-5 mt-5 text-center cursor-pointer transition"
            style={{
              border: `2px dashed ${dragOver || file ? "var(--sage)" : "var(--line-strong)"}`,
              borderStyle: file && !dragOver ? "solid" : "dashed",
              borderRadius: "var(--r-md)",
              padding: 40,
              background: dragOver || file ? "var(--bg-sage-tint)" : "var(--bg-paper)",
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input id="file-input" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "var(--bg-sage-tint)", border: "1px solid var(--line)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" style={{ color: "var(--sage-ink)" }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-900)", marginBottom: 4 }}>
              Drag and drop your CSV here
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-500)", marginBottom: 14, lineHeight: 1.5 }}>
              or click to browse.<br />One file per quarterly submission.
            </div>
            <button
              type="button"
              className="cd-btn cd-btn-primary"
              onClick={(e) => { e.stopPropagation(); document.getElementById("file-input")?.click(); }}
            >
              Browse files
            </button>
            <div className="mt-3" style={{ fontSize: 12, color: "var(--ink-500)" }}>
              Supported: .csv · Max: {MAX_SIZE_MB} MB
            </div>
          </div>

          {/* File selected */}
          {file && (
            <div
              className="mx-5 mt-4 flex items-center gap-3 px-4 py-3"
              style={{
                background: "var(--bg-sage-tint)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-md)",
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "var(--bg-white)", border: "1px solid var(--line)" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" style={{ color: "var(--sage-ink)" }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>{file.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-500)" }}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(); }}
                className="text-lg leading-none p-1"
                style={{ color: "var(--ink-500)" }}
              >
                ×
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="mx-5 mt-4 px-4 py-3 text-sm"
              style={{
                background: "var(--bg-clay-tint)",
                border: "1px solid var(--line)",
                borderLeft: "3px solid var(--clay-ink)",
                borderRadius: "var(--r-md)",
                color: "var(--clay-ink)",
              }}
            >
              {error}
            </div>
          )}

          {/* Success + GPMS field summary */}
          {result && (
            <div className="mx-5 mt-4 space-y-3">
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{
                  background: "var(--bg-sage-tint)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: "var(--sage-ink)" }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="flex-1" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-900)" }}>
                  CSV uploaded and validated successfully.
                </span>
                <Link
                  to="/dashboard"
                  className="hover:underline whitespace-nowrap"
                  style={{ fontSize: 13, fontWeight: 500, color: "var(--sage-ink)" }}
                >
                  View Dashboard
                </Link>
              </div>

              {/* GPMS field flag summary */}
              {uploadFlagSummary && (
                <div
                  className="px-4 py-3"
                  style={{
                    background: "var(--bg-blue-tint)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--r-md)",
                  }}
                >
                  <div className="flex items-start gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--blue-ink)" }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <div className="flex-1">
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>
                        {uploadFlagSummary.filled} of {uploadFlagSummary.total} GPMS fields auto-filled from CSV
                      </p>
                      <p className="mt-0.5" style={{ fontSize: 12, color: "var(--ink-500)" }}>
                        {uploadFlagSummary.unfilled} fields need manual entry (exclusion counts, dates, workforce details, etc.).
                        Form has been auto-filled, switch to Manual Entry to review and complete.
                      </p>
                      {gpmsFromUpload && Object.keys(gpmsFromUpload).length > 1 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span style={{ fontSize: 12, color: "var(--ink-500)" }}>Assessment date:</span>
                          <select
                            value={selectedGpmsDate}
                            onChange={e => {
                              const newDate = e.target.value;
                              setSelectedGpmsDate(newDate);
                              const vals = gpmsFromUpload[newDate] || {};
                              const filled = ALL_FIELD_KEYS.filter(k => vals[k] != null && vals[k] !== "").length;
                              setUploadFlagSummary({ filled, unfilled: ALL_FIELD_KEYS.length - filled, total: ALL_FIELD_KEYS.length });
                              const newForm = {};
                              const filledKeys = new Set();
                              for (const key of ALL_FIELD_KEYS) {
                                if (vals[key] != null && vals[key] !== "") {
                                  newForm[key] = String(vals[key]);
                                  filledKeys.add(key);
                                }
                              }
                              setFormData(newForm);
                              setPrefilledKeys(filledKeys);
                            }}
                            className="text-xs px-2 py-1"
                            style={{
                              background: "var(--bg-white)",
                              border: "1px solid var(--line)",
                              borderRadius: 6,
                              color: "var(--ink-900)",
                            }}
                          >
                            {Object.keys(gpmsFromUpload).sort().map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => { setActiveTab("manual"); setExpandedSections(new Set(GPMS_SECTIONS.map(s => s.id))); }}
                        className="cd-btn cd-btn-primary mt-3"
                        style={{ padding: "8px 14px", fontSize: 13 }}
                      >
                        Go to Manual Entry (review & complete)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <div className="mx-5 mt-5 mb-5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={uploading || !file}
              className="w-full disabled:cursor-not-allowed relative overflow-hidden transition"
              style={{
                padding: "11px 18px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                border: "1px solid transparent",
                background: uploading ? "var(--bg-white)" : "var(--ink-900)",
                color: uploading ? "var(--ink-900)" : "var(--bg-paper)",
                borderColor: uploading ? "var(--line)" : "var(--ink-900)",
                opacity: !file && !uploading ? 0.5 : 1,
              }}
            >
              {uploading ? (
                <>
                  <div
                    className="absolute inset-y-0 left-0 transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%`, background: "var(--bg-sage-tint)" }}
                  />
                  <span className="relative z-10" style={{ color: "var(--ink-900)" }}>
                    Processing… {Math.round(uploadProgress)}%
                  </span>
                </>
              ) : "Process & Validate CSV"}
            </button>
          </div>
        </div>

        {/* RIGHT: Submission history */}
        <div className="cd-surface overflow-hidden">
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ borderBottom: "1px solid var(--line-soft)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ink-500)" }}>
              <polyline points="12 8 12 12 14 14" /><path d="M3.05 11a9 9 0 1 1 .5 4" /><polyline points="3 16 3 11 8 11" />
            </svg>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-900)" }}>Submission history</h3>
          </div>
          <div className="p-4">
            {history.length === 0 ? (
              <p className="py-4" style={{ fontSize: 13, color: "var(--ink-500)" }}>
                No submissions yet. Upload a CSV above.
              </p>
            ) : (
              <table className="cd-table table-fixed">
                <thead>
                  <tr>
                    <th className="w-[38%]">File</th>
                    <th className="w-[22%]">Date</th>
                    <th className="w-[18%]">Status</th>
                    <th className="text-right w-[22%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr
                      key={item.uploadId}
                      style={selectedUploadId === item.uploadId ? { background: "var(--bg-sage-tint)" } : {}}
                    >
                      <td className="break-words min-w-0" style={{ fontWeight: 500 }} title={item.filename}>
                        {item.filename || "—"}
                      </td>
                      <td className="whitespace-nowrap" style={{ color: "var(--ink-500)" }}>
                        {formatUploadDate(item.uploadedAt)}
                      </td>
                      <td>
                        {selectedUploadId === item.uploadId ? (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: "var(--bg-sage-tint)",
                              color: "var(--sage-ink)",
                              border: "1px solid var(--sage)",
                            }}
                          >
                            Displaying
                          </span>
                        ) : (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: "var(--bg-sage-tint)",
                              color: "var(--sage-ink)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            Submitted
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleDownload(item.uploadId, item.filename)}
                            disabled={downloadingId === item.uploadId}
                            className="p-1.5 rounded disabled:opacity-60"
                            style={{
                              background: "var(--bg-white)",
                              border: "1px solid var(--line)",
                              color: "var(--ink-700)",
                            }}
                            title="Download CSV"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelected(selectedUploadId === item.uploadId ? "" : item.uploadId)}
                            className="p-1.5 rounded"
                            style={
                              selectedUploadId === item.uploadId
                                ? { background: "var(--sage-ink)", color: "var(--bg-paper)", border: "1px solid var(--sage-ink)" }
                                : { background: "var(--bg-white)", color: "var(--ink-500)", border: "1px solid var(--line)" }
                            }
                            title={selectedUploadId === item.uploadId ? "Used for dashboard" : "Use for dashboard"}
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            disabled={deletingId === item.uploadId}
                            className="p-1.5 rounded disabled:opacity-60"
                            style={{
                              background: "var(--bg-white)",
                              border: "1px solid var(--line)",
                              color: "var(--clay-ink)",
                            }}
                            title="Delete"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Manual Entry tab ───────────────────────────────────────────────────

  const manualEntryTab = (
    <div className="flex-1 min-w-0 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <span className="cd-chip mb-2" style={{ display: "inline-flex" }}>
            <span className="dot" /> GPMS aggregates
          </span>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 30,
              color: "var(--ink-900)",
              letterSpacing: "-0.01em",
              marginTop: 8,
              marginBottom: 4,
            }}
          >
            Manual entry
          </h1>
          <p style={{ color: "var(--ink-500)", fontSize: 14 }}>
            Enter aggregate QI data matching the GPMS submission fields. All values are whole numbers unless otherwise noted.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(gpmsDates.length > 0 || selectedGpmsDate) && (
            <select
              value={selectedGpmsDate}
              onChange={(e) => { setSelectedGpmsDate(e.target.value); setPrefillApplied(false); setPrefilledKeys(new Set()); }}
              className="text-xs px-2 py-1.5"
              style={{
                background: "var(--bg-white)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                color: "var(--ink-900)",
              }}
            >
              {!selectedGpmsDate && <option value="">Select date</option>}
              {[...new Set([...gpmsDates, ...(selectedGpmsDate ? [selectedGpmsDate] : [])])].sort().map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          {gpmsSaving && <span className="text-xs" style={{ color: "var(--ink-500)" }}>Saving…</span>}
          {!gpmsSaving && selectedGpmsDate && Object.keys(formData).length > 0 && (
            <span className="text-xs" style={{ color: "var(--sage-ink)" }}>Saved</span>
          )}
          <button
            type="button"
            onClick={() => setExpandedSections(new Set(GPMS_SECTIONS.map(s => s.id)))}
            className="text-xs px-2.5 py-1.5"
            style={{ background: "var(--bg-white)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink-700)" }}
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setExpandedSections(new Set())}
            className="text-xs px-2.5 py-1.5"
            style={{ background: "var(--bg-white)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink-700)" }}
          >
            Collapse all
          </button>
          <button
            type="button"
            onClick={clearForm}
            className="text-xs px-2.5 py-1.5"
            style={{ background: "var(--bg-white)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--clay-ink)" }}
          >
            Clear form
          </button>
        </div>
      </div>

      {/* Prefill banner */}
      {prefilledKeys.size > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 text-sm"
          style={{
            background: "var(--bg-sage-tint)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            color: "var(--ink-900)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: "var(--sage-ink)" }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>
            <strong>{prefilledKeys.size} fields</strong> auto-filled from CSV upload. Unfilled fields are highlighted in clay.
          </span>
        </div>
      )}

      {/* Note about QI 12 and QI 14 */}
      <div
        className="flex items-start gap-2 px-4 py-2.5 text-sm"
        style={{
          background: "var(--bg-blue-tint)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-md)",
          color: "var(--ink-700)",
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--blue-ink)" }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          QI 12 (Enrolled Nursing) and QI 14 (Lifestyle Officer) are extracted from the Quarterly Financial Report (QFR), not the QI application. They are not included in this form.
        </span>
      </div>

      {/* Accordion sections */}
      {GPMS_SECTIONS.map(section => {
        const isOpen = expandedSections.has(section.id);
        const sectionFilled = section.fields.filter(f => formData[f.key] != null && formData[f.key] !== "").length;
        const sectionRequired = section.fields.filter(f => f.required).length;
        const sectionRequiredFilled = section.fields.filter(f => f.required && formData[f.key] != null && formData[f.key] !== "").length;
        const allRequiredDone = sectionRequiredFilled === sectionRequired;

        return (
          <div key={section.id} className="cd-surface overflow-hidden">
            {/* Section header */}
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left transition"
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-paper)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`w-4 h-4 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`}
                style={{ color: "var(--ink-500)" }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>
                    QI {section.qiNum}, {section.title}
                  </span>
                  {allRequiredDone && sectionRequired > 0 && (
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: "var(--bg-sage-tint)",
                        color: "var(--sage-ink)",
                        border: "1px solid var(--sage)",
                      }}
                    >
                      Complete
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate" style={{ fontSize: 12, color: "var(--ink-500)" }}>
                  {section.desc}
                </p>
              </div>
              <span className="text-xs shrink-0" style={{ color: "var(--ink-500)" }}>
                {sectionFilled}/{section.fields.length}
              </span>
            </button>

            {/* Section fields */}
            {isOpen && (
              <div className="px-5 py-4" style={{ borderTop: "1px solid var(--line-soft)" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  {section.fields.map(field => {
                    const value = formData[field.key] ?? "";
                    const isEmpty = value === "" || value == null;
                    const isPrefilled = prefilledKeys.has(field.key);
                    const isRequired = field.required;
                    const showAmber = prefilledKeys.size > 0 && isEmpty && !isPrefilled;

                    return (
                      <div key={field.key} className="flex flex-col gap-1">
                        <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--ink-700)" }}>
                          {isPrefilled && !isEmpty && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: "var(--sage-ink)" }}
                              title="Auto-filled from CSV"
                            />
                          )}
                          {showAmber && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: "var(--clay)" }}
                              title="Needs manual entry"
                            />
                          )}
                          <span>{field.label}</span>
                          {isRequired && <span style={{ color: "var(--clay-ink)" }}>*</span>}
                        </label>
                        <input
                          type={field.type === "date" ? "date" : "number"}
                          min={field.type === "int" ? "0" : undefined}
                          step={field.type === "int" ? "1" : undefined}
                          value={value}
                          onChange={e => handleFieldChange(field.key, e.target.value)}
                          placeholder={field.type === "date" ? "YYYY-MM-DD" : "0"}
                          className="w-full px-3 py-2 text-sm transition focus:outline-none"
                          style={{
                            border: `1px solid ${showAmber ? "var(--clay)" : isPrefilled && !isEmpty ? "var(--sage)" : "var(--line)"}`,
                            borderRadius: 10,
                            background: showAmber ? "var(--bg-clay-tint)" : isPrefilled && !isEmpty ? "var(--bg-sage-tint)" : "var(--bg-paper)",
                            color: "var(--ink-900)",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ─── Download tab ───────────────────────────────────────────────────────

  const downloadTab = (
    <div className="flex-1 min-w-0 space-y-6">
      <div>
        <span className="cd-chip mb-2" style={{ display: "inline-flex" }}>
          <span className="dot" /> Export
        </span>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 30,
            color: "var(--ink-900)",
            letterSpacing: "-0.01em",
            marginTop: 8,
            marginBottom: 4,
          }}
        >
          Download &amp; export
        </h1>
        <p style={{ color: "var(--ink-500)", fontSize: 14 }}>
          Download the official government data recording template or export your manually entered data as an Excel file.
        </p>
      </div>

      {/* Error banner */}
      {downloadError && (
        <div
          className="px-4 py-3 text-sm"
          style={{
            background: "var(--bg-clay-tint)",
            border: "1px solid var(--line)",
            borderLeft: "3px solid var(--clay-ink)",
            borderRadius: "var(--r-md)",
            color: "var(--clay-ink)",
          }}
        >
          {downloadError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Government template */}
        <div className="cd-surface p-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "var(--bg-blue-tint)", border: "1px solid var(--line)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" style={{ color: "var(--blue-ink)" }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-900)", marginBottom: 6 }}>
            Government template
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-700)", marginBottom: 4 }}>
            Official QI Program data recording template (.xlsx) published by the Department of Health.
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-500)", marginBottom: 14 }}>
            13 sheets, one per indicator. Section 1 (GPMS aggregates) auto-calculates from Section 2 (individual data).
          </p>
          <button
            type="button"
            onClick={handleDownloadGovTemplate}
            disabled={downloadingTemplate}
            className="cd-btn w-full justify-center disabled:opacity-60"
            style={{ background: "var(--blue-ink)", color: "var(--bg-paper)", borderColor: "var(--blue-ink)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloadingTemplate ? "Downloading…" : "Download government template"}
          </button>
        </div>

        {/* Export manual entry */}
        <div className="cd-surface p-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "var(--bg-sage-tint)", border: "1px solid var(--line)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" style={{ color: "var(--sage-ink)" }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" /><path d="M9 15l3 3 3-3" />
            </svg>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-900)", marginBottom: 6 }}>
            Export manual entry
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-700)", marginBottom: 4 }}>
            Export your manually entered GPMS data as an Excel file (.xlsx) formatted to match the government template structure.
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-500)", marginBottom: 14 }}>
            {filledCount} of {ALL_FIELD_KEYS.length} fields filled · {requiredFilledCount} of {REQUIRED_KEYS.length} required fields complete
          </p>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filledCount === 0}
            className="cd-btn cd-btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export as Excel (.xlsx)
          </button>
          {filledCount === 0 && (
            <p className="mt-2 text-center" style={{ fontSize: 12, color: "var(--ink-500)" }}>
              Fill in at least one field in Manual Entry first
            </p>
          )}
        </div>
      </div>

      {/* Submission calendar */}
      <div className="cd-surface p-6">
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-900)", marginBottom: 6 }}>
          Submission calendar
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-500)", marginBottom: 16 }}>
          GPMS submission deadlines, 11:59pm AEST on the 21st of the month following quarter end.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { q: "Q1", period: "Jul – Sep", due: "21 October" },
            { q: "Q2", period: "Oct – Dec", due: "21 January" },
            { q: "Q3", period: "Jan – Mar", due: "21 April" },
            { q: "Q4", period: "Apr – Jun", due: "21 July" },
          ].map(item => (
            <div
              key={item.q}
              className="p-3 text-center"
              style={{
                background: "var(--bg-paper)",
                border: "1px solid var(--line-soft)",
                borderRadius: "var(--r-md)",
              }}
            >
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-900)", lineHeight: 1 }}>
                {item.q}
              </div>
              <div className="mt-1" style={{ fontSize: 12, color: "var(--ink-500)" }}>{item.period}</div>
              <div className="mt-1" style={{ fontSize: 12, fontWeight: 500, color: "var(--sage-ink)" }}>
                Due: {item.due}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Layout ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar />
      <main className="flex flex-grow pt-24 pb-12 px-4 sm:px-8 max-w-[1440px] mx-auto gap-6 w-full items-start">
        {sidebar}
        {activeTab === "upload" && uploadTab}
        {activeTab === "manual" && manualEntryTab}
        {activeTab === "download" && downloadTab}
      </main>
      <Footer />
    </div>
  );
}
