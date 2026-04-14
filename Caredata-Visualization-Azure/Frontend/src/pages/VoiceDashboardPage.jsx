/**
 * VoiceDashboardPage — Phase 3 Nurse-facing voice biomarker dashboard.
 *
 * Redesigned for 100+ residents:
 * - Searchable patient ID input (not select box)
 * - Tag-based batch link generation
 * - Sortable data table (replaces card grid)
 * - Diverse chart types: LineChart, RadarChart, BarChart, PieChart
 * - Style-guide palette colors (no purple)
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import VoiceAlertsFeed from "../components/voice/VoiceAlertsFeed";
import {
  getVoiceFacilitySummary,
  getVoiceAlerts,
  getVoiceResidents,
  getVoiceHistory,
  acknowledgeAlert,
  generateVoiceLink,
  generateVoiceLinksBatch,
  listVoiceLinks,
  getVoiceReport,
  getVoiceQiFlags,
  resetResidentPassword,
} from "../services/voiceApi";
import {
  LineChart, Line,
  BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ── Style-guide palette ─────────────────────────────────────────────────────
const PALETTE = {
  secondary: "#F2D894",  // soft gold
  info: "#D2C7E5",       // lavender
  success: "#D3EADA",    // mint
  warning: "#F2D894",    // soft gold
  error: "#F9C0AF",      // peach
  dark: "#4a3f35",
  gray1: "#6b5e52",
  gray2: "#8a7e72",
  gray3: "#b0a89e",
  gray4: "#F9ECE3",
  gray5: "#FDF8F4",
};

const ALERT_PIE_COLORS = [PALETTE.success, PALETTE.warning, PALETTE.error];

export default function VoiceDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);

  // Detail view
  const [selectedResident, setSelectedResident] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Link generation — searchable input
  const [existingLinks, setExistingLinks] = useState([]);
  const [linkInput, setLinkInput] = useState("");
  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [linkError, setLinkError] = useState("");
  const linkInputRef = useRef(null);

  // Batch link generation — tag-based
  const [batchMode, setBatchMode] = useState(false);
  const [batchInput, setBatchInput] = useState("");
  const [batchTags, setBatchTags] = useState([]);
  const [batchResults, setBatchResults] = useState(null);

  // QI flags
  const [qiFlags, setQiFlags] = useState([]);

  // Password reset
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  // Detail tabs
  const [detailTab, setDetailTab] = useState("chart");

  // Table sorting + search
  const [tableSearch, setTableSearch] = useState("");
  const [sortCol, setSortCol] = useState("display_name");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const [summaryData, alertsData, residentsData, linksData, flagsData] = await Promise.all([
        getVoiceFacilitySummary().catch(() => ({ active_alerts: 0, red_alerts: 0, amber_alerts: 0 })),
        getVoiceAlerts().catch(() => ({ alerts: [] })),
        getVoiceResidents().catch(() => ({ residents: [] })),
        listVoiceLinks().catch(() => ({ links: [] })),
        getVoiceQiFlags().catch(() => ({ flags: [] })),
      ]);
      setSummary(summaryData);
      setAlerts(alertsData.alerts || []);
      setResidents(residentsData.residents || []);
      setExistingLinks(linksData.links || []);
      setQiFlags(flagsData.flags || []);
    } catch { /* fallback */ } finally {
      setLoading(false);
      setAlertsLoading(false);
    }
  };

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleAcknowledge = useCallback(async (analysisId) => {
    try {
      await acknowledgeAlert(analysisId);
      setAlerts((prev) => prev.filter((a) => a.analysis_id !== analysisId));
      setSummary((prev) => prev ? { ...prev, active_alerts: Math.max(0, (prev.active_alerts || 1) - 1) } : prev);
    } catch (err) {
      console.error("Acknowledge error:", err);
      const msg = err?.response?.data?.detail || err?.message || "Unknown error";
      alert(`Failed to acknowledge alert: ${msg}`);
    }
  }, []);

  const handleViewHistory = useCallback(async (residentId) => {
    setSelectedResident(residentId);
    setHistoryLoading(true);
    setDetailTab("chart");
    try {
      const data = await getVoiceHistory(residentId);
      setHistoryData(data);
    } catch { setHistoryData(null); } finally { setHistoryLoading(false); }
  }, []);

  // ── Link helpers ────────────────────────────────────────────────────────

  function isExpired(link) {
    if (!link.expires_at) return false;
    try { return new Date() > new Date(link.expires_at); } catch { return false; }
  }

  function hasActiveLink(residentId) {
    return existingLinks.some((l) => l.resident_id === residentId && !isExpired(l));
  }

  function getActiveLinkUrl(residentId) {
    const link = existingLinks.find((l) => l.resident_id === residentId && !isExpired(l));
    return link ? `${window.location.origin}/voice/record/${link.token}` : null;
  }

  // Filtered suggestions for searchable input
  const linkSuggestions = useMemo(() => {
    if (!linkInput.trim()) return [];
    const q = linkInput.trim().toLowerCase();
    // Combine existing residents + links to build full ID list
    const allIds = new Set([
      ...residents.map((r) => r.resident_id).filter(Boolean),
      ...existingLinks.map((l) => l.resident_id).filter(Boolean),
    ]);
    return [...allIds].filter((id) => id.toLowerCase().includes(q)).slice(0, 10);
  }, [linkInput, residents, existingLinks]);

  const handleGenerateLink = useCallback(async (rid) => {
    const residentId = rid || linkInput.trim();
    setLinkError("");
    setGeneratedLink(null);
    if (!residentId) { setLinkError("Enter a resident ID."); return; }

    // Check existing
    const existingUrl = getActiveLinkUrl(residentId);
    if (existingUrl) {
      setGeneratedLink({ url: existingUrl, reused: true });
      setLinkInput("");
      setLinkDropdownOpen(false);
      return;
    }
    try {
      const result = await generateVoiceLink(residentId);
      setGeneratedLink(result);
      setLinkInput("");
      setLinkDropdownOpen(false);
      const updated = await listVoiceLinks().catch(() => ({ links: [] }));
      setExistingLinks(updated.links || []);
    } catch (err) {
      setLinkError(err.response?.data?.detail || "Failed to generate link.");
    }
  }, [linkInput, existingLinks]);

  // ── Batch handlers ──────────────────────────────────────────────────────

  const addBatchTag = useCallback(() => {
    const id = batchInput.trim();
    if (id && !batchTags.includes(id)) {
      setBatchTags([...batchTags, id]);
    }
    setBatchInput("");
  }, [batchInput, batchTags]);

  const removeBatchTag = useCallback((id) => {
    setBatchTags(batchTags.filter((t) => t !== id));
  }, [batchTags]);

  const handleBatchGenerate = useCallback(async () => {
    setLinkError("");
    setBatchResults(null);
    if (batchTags.length === 0) { setLinkError("Add at least one patient ID."); return; }
    try {
      const result = await generateVoiceLinksBatch(batchTags);
      setBatchResults(result.links || []);
      setBatchTags([]);
      const updated = await listVoiceLinks().catch(() => ({ links: [] }));
      setExistingLinks(updated.links || []);
    } catch (err) { setLinkError(err.response?.data?.detail || "Batch generation failed."); }
  }, [batchTags]);

  // ── Password reset ──────────────────────────────────────────────────────

  const handleResetPassword = useCallback(async () => {
    setResetMsg("");
    if (!resetTarget || resetPw.length < 4) { setResetMsg("Password must be at least 4 characters."); return; }
    try {
      await resetResidentPassword(resetTarget, resetPw);
      setResetMsg("Password reset successfully.");
      setResetPw("");
      setTimeout(() => { setResetTarget(null); setResetMsg(""); }, 2000);
    } catch (err) { setResetMsg(err.response?.data?.detail || "Reset failed."); }
  }, [resetTarget, resetPw]);

  // ── Chart data ──────────────────────────────────────────────────────────

  const chartData = historyData?.analyses?.slice().reverse().map((a, i) => ({
    recording: `#${i + 1}`,
    speechRate: a.acoustic_features?.speech_rate_proxy || 0,
    meanPause: a.acoustic_features?.mean_pause_duration_s || 0,
    pitch: a.acoustic_features?.pitch_mean_hz || 0,
    jitter: a.acoustic_features?.jitter_pct || 0,
    energy: a.acoustic_features?.mean_energy || 0,
    shimmer: a.acoustic_features?.shimmer_pct || 0,
    fatigue: a.acoustic_features?.vocal_fatigue_index || 0,
  })) || [];

  // Bar chart data — latest vs baseline
  const barCompareData = useMemo(() => {
    if (!historyData?.analyses || historyData.analyses.length < 2) return [];
    const latest = historyData.analyses[0]?.acoustic_features || {};
    const baseline = historyData.analyses[historyData.analyses.length - 1]?.acoustic_features || {};
    return [
      { metric: "Speech Rate", baseline: baseline.speech_rate_proxy || 0, latest: latest.speech_rate_proxy || 0 },
      { metric: "Pause (s)", baseline: baseline.mean_pause_duration_s || 0, latest: latest.mean_pause_duration_s || 0 },
      { metric: "Jitter (%)", baseline: baseline.jitter_pct || 0, latest: latest.jitter_pct || 0 },
      { metric: "Shimmer (%)", baseline: baseline.shimmer_pct || 0, latest: latest.shimmer_pct || 0 },
      { metric: "Fatigue Idx", baseline: baseline.vocal_fatigue_index || 0, latest: latest.vocal_fatigue_index || 0 },
    ];
  }, [historyData]);

  // Radar data — latest acoustic profile (normalized 0-100)
  const radarData = useMemo(() => {
    if (!historyData?.analyses?.[0]) return [];
    const f = historyData.analyses[0].acoustic_features || {};
    return [
      { feature: "Speech Rate", value: Math.min(100, (f.speech_rate_proxy || 0) * 25) },
      { feature: "Pause Control", value: Math.min(100, Math.max(0, 100 - (f.mean_pause_duration_s || 0) * 30)) },
      { feature: "Vocal Energy", value: Math.min(100, (f.mean_energy || 0) / 30) },
      { feature: "Pitch Stability", value: Math.min(100, Math.max(0, 100 - (f.pitch_std_hz || 0) * 3)) },
      { feature: "Jitter Control", value: Math.min(100, Math.max(0, 100 - (f.jitter_pct || 0) * 15)) },
      { feature: "Endurance", value: Math.min(100, (f.vocal_fatigue_index || 0) * 100) },
    ];
  }, [historyData]);

  // Alert distribution for summary donut
  const alertDistribution = useMemo(() => {
    const counts = { green: 0, amber: 0, red: 0 };
    residents.forEach((r) => {
      const level = r.latest_analysis?.alert_level || "green";
      counts[level] = (counts[level] || 0) + 1;
    });
    return [
      { name: "Normal", value: counts.green, color: PALETTE.success },
      { name: "Monitor", value: counts.amber, color: PALETTE.warning },
      { name: "Alert", value: counts.red, color: PALETTE.error },
    ].filter((d) => d.value > 0);
  }, [residents]);

  // ── Table sorting + filtering ───────────────────────────────────────────

  const filteredResidents = useMemo(() => {
    let list = [...residents];
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      list = list.filter(
        (r) =>
          (r.resident_id || "").toLowerCase().includes(q) ||
          (r.display_name || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case "alert_level": {
          const order = { red: 0, amber: 1, green: 2 };
          va = order[a.latest_analysis?.alert_level || "green"] ?? 2;
          vb = order[b.latest_analysis?.alert_level || "green"] ?? 2;
          break;
        }
        case "speech_rate":
          va = a.latest_analysis?.acoustic_features?.speech_rate_proxy ?? 0;
          vb = b.latest_analysis?.acoustic_features?.speech_rate_proxy ?? 0;
          break;
        case "pause":
          va = a.latest_analysis?.acoustic_features?.mean_pause_duration_s ?? 0;
          vb = b.latest_analysis?.acoustic_features?.mean_pause_duration_s ?? 0;
          break;
        case "deviation":
          va = a.latest_analysis?.risk_scores?.overall_deviation_pct ?? 0;
          vb = b.latest_analysis?.risk_scores?.overall_deviation_pct ?? 0;
          break;
        case "recordings":
          va = a.recording_count || 0;
          vb = b.recording_count || 0;
          break;
        default:
          va = (a.display_name || a.resident_id || "").toLowerCase();
          vb = (b.display_name || b.resident_id || "").toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [residents, tableSearch, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-gray-600 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow pt-28 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Voice Biomarker Screening</h1>

        {/* ── Summary strip ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          <SummaryCard label="Residents Screened" value={residents.length} />
          <SummaryCard label="Active Alerts" value={summary?.active_alerts ?? 0}
            color={summary?.red_alerts > 0 ? "text-red-600" : "text-amber-600"} />
          <SummaryCard label="Red Alerts" value={summary?.red_alerts ?? 0} color="text-red-600" />
          <SummaryCard label="QI Flags" value={qiFlags.length} color="text-blue-600" />
          {/* Mini alert distribution donut */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-center">
            {alertDistribution.length > 0 ? (
              <ResponsiveContainer width={90} height={90}>
                <PieChart>
                  <Pie data={alertDistribution} dataKey="value" cx="50%" cy="50%" innerRadius={22} outerRadius={38} strokeWidth={1}>
                    {alertDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-gray-400">No data</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column: Alerts + Link gen + QI ─────────────────── */}
          <div className="lg:col-span-1 space-y-6">
            {/* Alerts */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Alerts</h2>
              <VoiceAlertsFeed alerts={alerts} onAcknowledge={handleAcknowledge} loading={alertsLoading} />
            </div>

            {/* ── Generate Recording Link ───────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Generate Recording Link</h2>
                <button onClick={() => { setBatchMode(!batchMode); setGeneratedLink(null); setBatchResults(null); setLinkError(""); }}
                  className="text-xs font-medium hover:underline" style={{ color: PALETTE.secondary }}>
                  {batchMode ? "Single" : "Batch"}
                </button>
              </div>

              {!batchMode ? (
                /* ── Single mode — searchable input ──────────────────── */
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      ref={linkInputRef}
                      type="text"
                      value={linkInput}
                      onChange={(e) => { setLinkInput(e.target.value); setLinkDropdownOpen(true); setGeneratedLink(null); }}
                      onFocus={() => setLinkDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setLinkDropdownOpen(false), 200)}
                      placeholder="Type patient ID (e.g. R001)..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                                 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none bg-white"
                    />
                    {/* Dropdown suggestions */}
                    {linkDropdownOpen && linkSuggestions.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {linkSuggestions.map((id) => (
                          <button key={id}
                            onMouseDown={(e) => { e.preventDefault(); setLinkInput(id); setLinkDropdownOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between">
                            <span>{id}</span>
                            {hasActiveLink(id) && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ background: "#e8f5e9", color: PALETTE.success }}>Generated</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={() => handleGenerateLink()}
                    className="w-full py-2.5 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity text-sm"
                    style={{ background: PALETTE.secondary }}>
                    {hasActiveLink(linkInput.trim()) ? "Show Existing Link" : "Generate Link"}
                  </button>

                  {linkError && <p className="text-sm text-red-600">{linkError}</p>}
                  {generatedLink && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm font-medium" style={{ color: PALETTE.success }}>
                        {generatedLink.reused ? "Existing link:" : "Link generated:"}
                      </p>
                      <p className="text-xs text-green-700 break-all mt-1">{generatedLink.url}</p>
                      <button onClick={() => navigator.clipboard.writeText(generatedLink.url)}
                        className="mt-2 text-xs font-medium hover:underline" style={{ color: PALETTE.secondary }}>
                        Copy to clipboard
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Batch mode — tag-based input ────────────────────── */
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">Enter patient IDs to generate links in batch:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={batchInput}
                      onChange={(e) => setBatchInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBatchTag(); } }}
                      placeholder="Type ID + Enter..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm
                                 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                    />
                    <button onClick={addBatchTag}
                      className="px-4 py-2 text-white text-sm font-medium rounded-lg"
                      style={{ background: PALETTE.secondary }}>
                      Add
                    </button>
                  </div>

                  {/* Tags */}
                  {batchTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {batchTags.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                          {id}
                          {hasActiveLink(id) && <span className="text-xs" style={{ color: PALETTE.success }}>✓</span>}
                          <button onClick={() => removeBatchTag(id)} className="text-gray-400 hover:text-red-500 ml-1">&times;</button>
                        </span>
                      ))}
                    </div>
                  )}

                  <button onClick={handleBatchGenerate} disabled={batchTags.length === 0}
                    className="w-full py-2.5 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-50"
                    style={{ background: PALETTE.secondary }}>
                    Generate {batchTags.length} Link{batchTags.length !== 1 ? "s" : ""}
                  </button>

                  {linkError && <p className="text-sm text-red-600">{linkError}</p>}
                  {batchResults && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium" style={{ color: PALETTE.success }}>{batchResults.length} links generated:</p>
                      {batchResults.map((l) => (
                        <div key={l.token} className="flex items-center justify-between text-xs text-green-700">
                          <span className="font-medium">{l.resident_id}</span>
                          <button onClick={() => navigator.clipboard.writeText(l.url)}
                            className="hover:underline" style={{ color: PALETTE.secondary }}>Copy</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* QI Flags */}
            {qiFlags.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">QI Integration Flags</h2>
                <div className="space-y-3">
                  {qiFlags.map((f) => (
                    <div key={f.analysis_id} className="border border-gray-200 rounded-lg p-3">
                      <p className="font-medium text-gray-900 text-sm">{f.display_name}</p>
                      {f.qi_flags.map((qi, i) => (
                        <div key={i} className="mt-1 flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            qi.severity === "red" ? "bg-red-500" : qi.severity === "amber" ? "bg-amber-500" : "bg-green-500"}`} />
                          <div>
                            <p className="text-xs font-medium text-gray-700">{qi.qi_category}</p>
                            <p className="text-xs text-gray-500">{qi.flag}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Password Reset */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Reset Resident Password</h2>
              <div className="space-y-3">
                <select value={resetTarget || ""} onChange={(e) => { setResetTarget(e.target.value || null); setResetMsg(""); }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none">
                  <option value="">Select resident...</option>
                  {residents.map((r) => (
                    <option key={r.resident_id} value={r.resident_id}>
                      {r.display_name || r.resident_id}
                    </option>
                  ))}
                </select>
                {resetTarget && (
                  <>
                    <input type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)}
                      placeholder="New password (min 4 chars)"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none" />
                    <button onClick={handleResetPassword}
                      className="w-full py-2.5 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm">
                      Reset Password
                    </button>
                    {resetMsg && <p className={`text-sm ${resetMsg.includes("success") ? "text-green-600" : "text-red-600"}`}>{resetMsg}</p>}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Right column: Detail + Table ────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detail view */}
            {selectedResident && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {historyData?.profile?.display_name || selectedResident}
                  </h2>
                  <div className="flex items-center gap-3">
                    <a href={getVoiceReport(selectedResident)} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline" style={{ color: PALETTE.secondary }}>
                      Download Report
                    </a>
                    <button onClick={() => { setSelectedResident(null); setHistoryData(null); }}
                      className="text-sm text-gray-500 hover:text-gray-700">Close</button>
                  </div>
                </div>

                {/* Detail tabs */}
                <div className="flex gap-1 mb-4 border-b border-gray-200">
                  {[
                    { key: "chart", label: "Trend Chart" },
                    { key: "compare", label: "Baseline Compare" },
                    { key: "profile", label: "Acoustic Profile" },
                    { key: "transcript", label: "Transcript" },
                    { key: "qi", label: "QI Flags" },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => setDetailTab(key)}
                      className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                        detailTab === key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>

                {historyLoading ? (
                  <p className="text-sm text-gray-400 py-4">Loading history...</p>
                ) : detailTab === "chart" ? (
                  /* ── Trend LineChart ────────────────────────────────── */
                  chartData.length > 0 ? (
                    <div>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="recording" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="speechRate" stroke={PALETTE.secondary} strokeWidth={2} name="Speech Rate" dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="meanPause" stroke={PALETTE.info} strokeWidth={2} name="Mean Pause (s)" dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="pitch" stroke={PALETTE.success} strokeWidth={2} name="Pitch (Hz)" dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="jitter" stroke={PALETTE.error} strokeWidth={1.5} name="Jitter (%)" dot={{ r: 3 }} strokeDasharray="5 5" />
                        </LineChart>
                      </ResponsiveContainer>
                      {historyData?.analyses?.[0]?.narrative_report && (
                        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-700 mb-1">Latest Clinical Narrative</p>
                          <p className="text-sm text-gray-600">{historyData.analyses[0].narrative_report}</p>
                        </div>
                      )}
                    </div>
                  ) : <p className="text-sm text-gray-400 py-4">No analysis data available.</p>

                ) : detailTab === "compare" ? (
                  /* ── Baseline Compare BarChart ──────────────────────── */
                  barCompareData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={barCompareData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="baseline" fill={PALETTE.gray4} name="Baseline" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="latest" fill={PALETTE.secondary} name="Latest" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-gray-400 py-4">Need at least 2 recordings for comparison.</p>

                ) : detailTab === "profile" ? (
                  /* ── Acoustic Profile RadarChart ────────────────────── */
                  radarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke={PALETTE.gray5} />
                        <PolarAngleAxis dataKey="feature" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Radar name="Current" dataKey="value" stroke={PALETTE.secondary} fill={PALETTE.secondary} fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-gray-400 py-4">No analysis data available.</p>

                ) : detailTab === "transcript" ? (
                  /* ── Transcripts ────────────────────────────────────── */
                  <div className="space-y-3">
                    {historyData?.analyses?.filter((a) => a.transcript).length > 0 ? (
                      historyData.analyses.filter((a) => a.transcript).map((a) => (
                        <div key={a.analysis_id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-xs text-gray-400 mb-1">
                            {a.created_at?.slice(0, 10)} · <span className={
                              a.alert_level === "red" ? "text-red-500" : a.alert_level === "amber" ? "text-amber-500" : "text-green-500"
                            }>{a.alert_level}</span>
                          </p>
                          <p className="text-sm text-gray-700 italic">"{a.transcript}"</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-400">No transcripts available.</p>
                        <p className="text-sm text-gray-400 mt-1">Transcription requires OpenAI API key.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── QI Flags ───────────────────────────────────────── */
                  <div className="space-y-3">
                    {qiFlags.filter((f) => f.resident_id === selectedResident).length > 0 ? (
                      qiFlags.filter((f) => f.resident_id === selectedResident).map((f) =>
                        f.qi_flags.map((qi, i) => (
                          <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start gap-3">
                            <span className={`w-3 h-3 rounded-full mt-0.5 ${
                              qi.severity === "red" ? "bg-red-500" : qi.severity === "amber" ? "bg-amber-500" : "bg-green-500"}`} />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{qi.qi_category}</p>
                              <p className="text-sm text-gray-600">{qi.flag}</p>
                              <p className="text-xs text-gray-400 mt-1">Indicator: {qi.indicator}</p>
                            </div>
                          </div>
                        ))
                      )
                    ) : (
                      <div className="text-center py-8"><p className="text-gray-400">No QI flags for this resident.</p></div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Residents Table ───────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Residents ({residents.length})</h2>
                <input type="text" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search by name or ID..."
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-56
                             focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none" />
              </div>

              {loading ? (
                <p className="text-sm text-gray-400">Loading residents...</p>
              ) : filteredResidents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">
                    {residents.length === 0 ? "No residents screened yet." : "No results match your search."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {[
                          { col: "display_name", label: "Resident" },
                          { col: "alert_level", label: "Status" },
                          { col: "speech_rate", label: "Speech Rate" },
                          { col: "pause", label: "Pause (s)" },
                          { col: "deviation", label: "Deviation" },
                          { col: "recordings", label: "Recordings" },
                        ].map(({ col, label }) => (
                          <th key={col} onClick={() => toggleSort(col)}
                            className="text-left py-2.5 px-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                            {label}<SortIcon col={col} />
                          </th>
                        ))}
                        <th className="text-right py-2.5 px-3 font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResidents.map((r) => {
                        const level = r.latest_analysis?.alert_level || "green";
                        const f = r.latest_analysis?.acoustic_features || {};
                        const dev = r.latest_analysis?.risk_scores?.overall_deviation_pct;
                        return (
                          <tr key={r.profile_id}
                            className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                              selectedResident === r.resident_id ? "bg-primary-light" : ""}`}
                            onClick={() => handleViewHistory(r.resident_id)}>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                  level === "red" ? "bg-red-500" : level === "amber" ? "bg-amber-500" : "bg-green-500"}`} />
                                <div>
                                  <p className="font-medium text-gray-900">{r.display_name || r.resident_id}</p>
                                  <p className="text-xs text-gray-400">{r.resident_id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                level === "red" ? "bg-red-100 text-red-700"
                                : level === "amber" ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"}`}>
                                {level === "red" ? "Alert" : level === "amber" ? "Monitor" : "Normal"}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-gray-700">
                              {f.speech_rate_proxy != null ? `${f.speech_rate_proxy}/s` : "—"}
                            </td>
                            <td className="py-3 px-3 font-mono text-gray-700">
                              {f.mean_pause_duration_s != null ? f.mean_pause_duration_s.toFixed(2) : "—"}
                            </td>
                            <td className="py-3 px-3">
                              {dev != null ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${
                                      level === "red" ? "bg-red-500" : level === "amber" ? "bg-amber-500" : "bg-green-500"}`}
                                      style={{ width: `${Math.min(100, dev)}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-600 font-mono">{dev.toFixed(0)}%</span>
                                </div>
                              ) : "—"}
                            </td>
                            <td className="py-3 px-3 text-gray-700">{r.recording_count || 0}</td>
                            <td className="py-3 px-3 text-right">
                              <button onClick={(e) => { e.stopPropagation(); handleViewHistory(r.resident_id); }}
                                className="text-xs font-medium hover:underline" style={{ color: PALETTE.secondary }}>
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-8 text-xs text-gray-400 text-center">
          This analysis is a clinical decision support tool. It does not constitute a diagnosis.
          All flagged conditions require clinical assessment by a qualified health professional.
        </p>
      </main>
      <Footer />
    </div>
  );
}

function SummaryCard({ label, value, color = "text-gray-900" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
