import { useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import {
  getMyData,
  getRecommendations,
  getUploadHistory,
  getQIAggregates,
  getHealthScanHistory,
  getSettings,
} from "../../services/api";

const PRESETS = {
  personal: {
    label: "Personal Health Report",
    options: { myData: true, charts: true, aiRecommendations: true, facilityAnalytics: false, uploadHistory: false },
  },
  facility: {
    label: "Facility Analytics Report",
    options: { myData: false, charts: true, aiRecommendations: false, facilityAnalytics: true, uploadHistory: false },
  },
  full: {
    label: "Full Report",
    options: { myData: true, charts: true, aiRecommendations: true, facilityAnalytics: true, uploadHistory: true },
  },
};

const OPTION_LABELS = {
  myData: "My Data",
  charts: "Charts",
  aiRecommendations: "AI Recommendations",
  facilityAnalytics: "Facility Analytics",
  uploadHistory: "Upload History",
};

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

const SETTINGS_LABELS = {
  firstName: "First Name",
  lastName: "Last Name",
  jobTitle: "Job Title",
  facilityName: "Facility Name",
  facilityType: "Facility Type",
  facilityRegistration: "Registration / Accreditation",
  abn: "ABN",
  street: "Street",
  suburb: "Suburb",
  state: "State",
  postcode: "Postcode",
  bedCapacity: "Bed / Capacity",
  contactEmail: "Contact Email",
  contactPhone: "Phone",
  emergencyContact: "Emergency Contact (24/7)",
  delegatedContact: "Delegated / Backup Contact",
  afterHoursContact: "After-Hours Contact",
};

const FACILITY_TYPE_LABELS = {
  residential: "Residential Aged Care",
  day_centre: "Day Centre",
  respite: "Respite Care",
  home_care: "Home Care",
  other: "Other",
};

function buildReportHtml(data) {
  const { myData, recommendations, uploadHistory, dashboardData, healthScanHistory, options, selectedUploadId, settings } = data;

  const sections = [];

  if (settings && typeof settings === "object") {
    const rows = [];
    Object.entries(SETTINGS_LABELS).forEach(([key, label]) => {
      let value = settings[key];
      if (key === "facilityType" && value) value = FACILITY_TYPE_LABELS[value] || value;
      if (value != null && String(value).trim() !== "") {
        rows.push({ label, value: String(value).trim() });
      }
    });
    if (rows.length > 0) {
      sections.push({
        title: "Facility & User Information",
        html: `
          <table class="report-table">
            <thead><tr><th>Field</th><th>Value</th></tr></thead>
            <tbody>
              ${rows.map((r) => `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.value)}</td></tr>`).join("")}
            </tbody>
          </table>
        `,
      });
    }
  }

  if (options.myData && myData) {
    const rows = [];
    const sections_data = [
      myData.keyInformation,
      myData.patientContext,
      myData.clinicalMeasurements,
      myData.trendAndRisk,
    ].filter(Boolean);
    sections_data.forEach((section) => {
      if (section && typeof section === "object") {
        Object.entries(section).forEach(([label, value]) => {
          if (value != null && String(value).trim() !== "") {
            rows.push({ label, value: String(value) });
          }
        });
      }
    });
    if (rows.length > 0) {
      sections.push({
        title: "My Data",
        html: `
          <table class="report-table">
            <thead><tr><th>Field</th><th>Value</th></tr></thead>
            <tbody>
              ${rows.map((r) => `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.value)}</td></tr>`).join("")}
            </tbody>
          </table>
        `,
      });
    }
  }

  if (options.charts) {
    const chartData = myData
      ? buildChartDataFromMyData(myData)
      : dashboardData?.chartData
        ? dashboardData.chartData.map((d) => ({ name: d.name, value: d.value }))
        : [];
    if (chartData.length > 0) {
      sections.push({
        title: "Charts (Data Summary)",
        html: `
          <table class="report-table">
            <thead><tr><th>Metric</th><th>Value</th></tr></thead>
            <tbody>
              ${chartData.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(String(r.value))}</td></tr>`).join("")}
            </tbody>
          </table>
        `,
      });
    }
  }

  if (options.aiRecommendations && recommendations) {
    const items = [];
    const rec = recommendations;
    if (Array.isArray(rec)) {
      items.push(...rec.filter(Boolean).map((r) => (typeof r === "string" ? r : String(r))));
    } else if (rec && typeof rec === "object") {
      const parts = [
        rec.actions && `What to do: ${rec.actions}`,
        rec.diet && `Diet: ${rec.diet}`,
        rec.exercise && `Exercise: ${rec.exercise}`,
        rec.risks && `Risks: ${rec.risks}`,
      ].filter(Boolean);
      items.push(...parts);
    }
    if (items.length > 0) {
      sections.push({
        title: "AI Recommendations",
        html: `<ul class="report-list">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`,
      });
    }
  }

  if (options.facilityAnalytics && dashboardData) {
    const parts = [];
    if (dashboardData.trendsComing) {
      parts.push(`<h4>Trends</h4><p>${escapeHtml(dashboardData.trendsComing)}</p>`);
    }
    if (dashboardData.thingsToMonitor) {
      parts.push(`<h4>Things to Monitor</h4><p>${escapeHtml(dashboardData.thingsToMonitor)}</p>`);
    }
    if (dashboardData.chartData && dashboardData.chartData.length > 0) {
      parts.push(`
        <h4>Facility Metrics</h4>
        <table class="report-table">
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            ${dashboardData.chartData.map((d) => `<tr><td>${escapeHtml(d.name)}</td><td>${escapeHtml(String(d.value))}</td></tr>`).join("")}
          </tbody>
        </table>
      `);
    }
    if (parts.length > 0) {
      sections.push({ title: "Facility Analytics", html: parts.join("") });
    }
  }

  if (options.uploadHistory && (uploadHistory?.length > 0 || healthScanHistory?.length > 0)) {
    const csvRows = (uploadHistory || []).map((u) => ({
      type: "CSV Upload",
      id: u.uploadId,
      date: u.uploadedAt,
      name: u.filename || u.uploadId,
    }));
    const scanRows = (healthScanHistory || []).map((s) => ({
      type: "Health Scan",
      id: s.scanId,
      date: s.scannedAt,
      name: `Scan (${s.imageCount ?? 0} images)`,
    }));
    const all = [...csvRows, ...scanRows].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    sections.push({
      title: "Upload History",
      html: `
        <table class="report-table">
          <thead><tr><th>Type</th><th>Date</th><th>Details</th></tr></thead>
          <tbody>
            ${all.map((r) => `<tr><td>${escapeHtml(r.type)}</td><td>${formatDate(r.date)}</td><td>${escapeHtml(r.name)}</td></tr>`).join("")}
          </tbody>
        </table>
      `,
    });
  }

  const bodyHtml = sections
    .map((s) => `<section><h2>${escapeHtml(s.title)}</h2>${s.html}</section>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CareData Report - ${formatDate(new Date().toISOString())}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #1f2937; line-height: 1.6; }
    h1 { font-size: 1.75rem; color: #111827; margin-bottom: 0.5rem; }
    h2 { font-size: 1.25rem; color: #374151; margin-top: 2rem; margin-bottom: 0.75rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem; }
    h4 { font-size: 1rem; margin: 1rem 0 0.5rem; }
    .report-table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; }
    .report-table th, .report-table td { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left; }
    .report-table th { background: #f9fafb; font-weight: 600; }
    .report-list { margin: 0.5rem 0; padding-left: 1.5rem; }
    .report-list li { margin: 0.25rem 0; }
    .meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 2rem; }
    @media print { body { padding: 1rem; } }
  </style>
</head>
<body>
  <h1>CareData Health Report</h1>
  <p class="meta">Generated on ${formatDate(new Date().toISOString())}</p>
  ${bodyHtml || "<p>No data available for selected sections.</p>"}
</body>
</html>`;
}

function buildChartDataFromMyData(myData) {
  const all = [myData.keyInformation, myData.patientContext, myData.clinicalMeasurements, myData.trendAndRisk];
  const numeric = [];
  all.forEach((section) => {
    if (!section || typeof section !== "object") return;
    Object.entries(section).forEach(([label, value]) => {
      const n = parseFloat(String(value).trim());
      if (!isNaN(n) && isFinite(n)) numeric.push({ name: label, value: n });
    });
  });
  return numeric;
}

function escapeHtml(s) {
  if (s == null) return "";
  const str = String(s);
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export default function DocumentationPage() {
  const [selectedOptions, setSelectedOptions] = useState({
    myData: true,
    charts: true,
    aiRecommendations: true,
    facilityAnalytics: false,
    uploadHistory: false,
  });
  const [preset, setPreset] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [selectedUploadId, setSelectedUploadId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getUploadHistory()
      .then((list) => setUploadHistory(Array.isArray(list) ? list : []))
      .catch(() => setUploadHistory([]));
  }, []);

  const handleChange = (option) => {
    setPreset(null);
    setSelectedOptions((prev) => ({ ...prev, [option]: !prev[option] }));
  };

  const applyPreset = (key) => {
    const p = PRESETS[key];
    if (p) {
      setPreset(key);
      setSelectedOptions({ ...p.options });
    }
  };

  const needsUpload = selectedOptions.facilityAnalytics;
  const hasUploads = uploadHistory.length > 0;

  const handleGenerate = async () => {
    if (needsUpload && !selectedUploadId) {
      setError("Please select a CSV upload for Facility Analytics.");
      return;
    }
    setError("");
    setGenerating(true);
    try {
      const promises = {
        settings: getSettings().catch(() => null),
        myData: (selectedOptions.myData || selectedOptions.charts || selectedOptions.aiRecommendations) ? getMyData() : Promise.resolve(null),
        recommendations: selectedOptions.aiRecommendations ? getRecommendations() : Promise.resolve(null),
        uploadHistory: selectedOptions.uploadHistory ? getUploadHistory() : Promise.resolve([]),
        healthScanHistory: selectedOptions.uploadHistory ? getHealthScanHistory() : Promise.resolve([]),
        dashboardData: selectedOptions.facilityAnalytics ? getQIAggregates().catch(() => null) : Promise.resolve(null),
      };
      const [settings, myData, recommendations, uploads, scans, dashboardData] = await Promise.all([
        promises.settings,
        promises.myData,
        promises.recommendations,
        promises.uploadHistory,
        promises.healthScanHistory,
        promises.dashboardData,
      ]);
      const html = buildReportHtml({
        myData,
        recommendations,
        uploadHistory: uploads,
        healthScanHistory: scans,
        dashboardData,
        options: selectedOptions,
        selectedUploadId,
        settings: settings || (() => {
          try {
            const stored = localStorage.getItem("caredata_facility_settings");
            return stored ? JSON.parse(stored) : null;
          } catch {
            return null;
          }
        })(),
      });

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const container = document.createElement("div");
      container.style.cssText =
        "position:fixed;left:0;top:0;width:794px;padding:40px;background:#fff;color:#1f2937;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;z-index:9999;";
      container.innerHTML = doc.body.innerHTML;
      const style = document.createElement("style");
      style.textContent = `
        .report-pdf-container * { box-sizing: border-box; }
        .report-pdf-container h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
        .report-pdf-container h2 { font-size: 18px; color: #374151; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .report-pdf-container h4 { font-size: 14px; margin: 16px 0 8px; }
        .report-pdf-container .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
        .report-pdf-container .report-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        .report-pdf-container .report-table th, .report-pdf-container .report-table td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
        .report-pdf-container .report-table th { background: #f9fafb; font-weight: 600; }
        .report-pdf-container .report-list { margin: 8px 0; padding-left: 24px; }
        .report-pdf-container .report-list li { margin: 4px 0; }
      `;
      container.className = "report-pdf-container";
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:9998;display:flex;align-items:center;justify-content:center;";
      overlay.innerHTML = '<div style="background:#fff;padding:1rem 2rem;border-radius:8px;font-weight:500;">Generating PDF...</div>';
      document.body.appendChild(style);
      document.body.appendChild(overlay);
      document.body.appendChild(container);

      await new Promise((r) => setTimeout(r, 300));

      try {
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const pdf = new jsPDF("p", "mm", "a4");
        const pageW = 210;
        const pageH = 297;
        const margin = 12;
        const contentW = pageW - 2 * margin;
        const contentH = pageH - 2 * margin;
        const imgW = contentW;
        const imgH = (canvas.height * contentW) / canvas.width;
        let position = margin;
        pdf.addImage(imgData, "JPEG", margin, position, imgW, imgH);
        let heightLeft = imgH - contentH;
        let pageNum = 1;
        while (heightLeft > 0) {
          pdf.addPage();
          position = margin - pageNum * contentH;
          pdf.addImage(imgData, "JPEG", margin, position, imgW, imgH);
          heightLeft -= contentH;
          pageNum++;
        }
        const filename = `CareData-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
        pdf.save(filename);
      } finally {
        overlay.remove();
        style.remove();
        if (container.parentNode) container.remove();
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 max-w-7xl mx-auto gap-6">
        <MyDataSidebar activePage="Documentation" />

        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            Documentation Generator
          </h1>
          <p className="text-gray-600 mb-8">
            Choose which elements to include in your report. The report downloads automatically as a PDF file.
          </p>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Presets</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    preset === key
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {Object.entries(OPTION_LABELS).map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition"
              >
                <label className="text-gray-800 font-medium">{label}</label>
                <input
                  type="checkbox"
                  checked={selectedOptions[key]}
                  onChange={() => handleChange(key)}
                  className="w-5 h-5 text-primary focus:ring-primary/60 rounded"
                />
              </div>
            ))}
          </div>

          {needsUpload && (
            <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-sm font-medium text-amber-800 mb-2">Select CSV upload</label>
              <select
                value={selectedUploadId}
                onChange={(e) => setSelectedUploadId(e.target.value)}
                className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-gray-800"
              >
                <option value="">— Choose upload —</option>
                {uploadHistory.map((u) => (
                  <option key={u.uploadId} value={u.uploadId}>
                    {u.filename || u.uploadId} ({formatDate(u.uploadedAt)})
                  </option>
                ))}
              </select>
              {needsUpload && !hasUploads && (
                <p className="mt-2 text-sm text-amber-700">No CSV uploads found. Upload a CSV first.</p>
              )}
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-center mt-8">
            <button
              onClick={handleGenerate}
              disabled={generating || (needsUpload && !selectedUploadId)}
              className="bg-primary text-white px-6 py-3 rounded-md font-medium hover:bg-primary-hover transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? "Generating…" : "Generate Documentation"}
            </button>
          </div>

          <div className="mt-10 bg-primary-light border border-primary/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary mb-2">Tip</h3>
            <p className="text-gray-700 leading-relaxed mb-2">
              Use presets for quick report types. The report downloads as a PDF automatically.
            </p>
            <p className="text-gray-600 text-sm">
              <strong>Data needed:</strong> Personal Health Report uses My Data (from Health Scan or manual entry). Facility Analytics requires a CSV upload—upload a CSV first, then select it above.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
