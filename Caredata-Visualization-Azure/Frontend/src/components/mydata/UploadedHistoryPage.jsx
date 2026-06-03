import { useState, useEffect } from "react";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import MobileSidebarPanel, { PAGE_MAIN_ROW } from "../common/MobileSidebarPanel";
import {
  getUploadHistory,
  deleteUpload,
  clearUploadHistory,
  getHealthScanHistory,
  deleteHealthScan,
  clearHealthScanHistory,
} from "../../services/api";
import { Trash2, RotateCcw, FileSpreadsheet, Scan } from "../../icons/lucideBundle";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function UploadedHistoryPage() {
  const [csvList, setCsvList] = useState([]);
  const [scanList, setScanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingKey, setDeletingKey] = useState(null); // "csv:uploadId" or "scan:scanId"
  const [clearing, setClearing] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([getUploadHistory(), getHealthScanHistory()])
      .then(([csv, scans]) => {
        console.log("[UploadedHistory] getUploadHistory:", csv);
        console.log("[UploadedHistory] getHealthScanHistory:", scans);
        setCsvList(Array.isArray(csv) ? csv : []);
        setScanList(Array.isArray(scans) ? scans : []);
      })
      .catch((err) => {
        console.error("[UploadedHistory] API error:", err);
        setCsvList([]);
        setScanList([]);
        setError("Failed to load history.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Merge and sort by date (newest first)
  const merged = [
    ...csvList.map((u) => ({
      type: "csv",
      id: u.uploadId,
      date: u.uploadedAt,
      filename: u.filename || u.uploadId,
      imageCount: null,
    })),
    ...scanList.map((s) => ({
      type: "health_scan",
      id: s.scanId,
      date: s.scannedAt,
      filename: null,
      imageCount: s.imageCount ?? 0,
    })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const handleRemove = async (item) => {
    const key = `${item.type}:${item.id}`;
    setDeletingKey(key);
    setError("");
    try {
      if (item.type === "csv") {
        await deleteUpload(item.id);
        setCsvList((prev) => prev.filter((u) => u.uploadId !== item.id));
      } else {
        await deleteHealthScan(item.id);
        setScanList((prev) => prev.filter((s) => s.scanId !== item.id));
      }
    } catch {
      setError("Failed to remove this item.");
    } finally {
      setDeletingKey(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all upload and Health Scan history? This cannot be undone.")) return;
    setClearing(true);
    setError("");
    try {
      await Promise.all([clearUploadHistory(), clearHealthScanHistory()]);
      setCsvList([]);
      setScanList([]);
    } catch {
      setError("Failed to clear history.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar active="My Data" />

      <main className={`${PAGE_MAIN_ROW} pt-32 max-w-[1280px]`}>
        <MobileSidebarPanel menuLabel="Workspace">
          <MyDataSidebar activePage="Uploaded History" />
        </MobileSidebarPanel>

        <div className="flex-1 min-w-0 w-full cd-surface p-4 sm:p-8">
          <span className="cd-chip mb-3" style={{ display: "inline-flex" }}>
            <span className="dot" /> History
          </span>
          <h1
            className="mb-3"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 30,
              color: "var(--ink-900)",
              letterSpacing: "-0.01em",
            }}
          >
            Uploaded history
          </h1>
          <p className="mb-10" style={{ color: "var(--ink-500)", fontSize: 14 }}>
            History of CSV uploads and Health Scan records. View time, kind, images, and CSV filename below.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            {merged.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={clearing}
                className="inline-flex items-center gap-2"
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  background: "var(--bg-clay-tint)",
                  border: "1px solid var(--line)",
                  color: "var(--clay-ink)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: clearing ? "not-allowed" : "pointer",
                  opacity: clearing ? 0.5 : 1,
                  transition: "all .15s ease",
                }}
              >
                <RotateCcw size={16} />
                {clearing ? "Clearing…" : "Clear all history"}
              </button>
            )}
          </div>

          {error && (
            <div
              className="mb-4 px-4 py-3"
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

          {loading && (
            <p className="text-center mb-6" style={{ fontSize: 13, color: "var(--ink-500)" }}>
              Loading…
            </p>
          )}

          {!loading && merged.length === 0 && (
            <div className="py-12 text-center" style={{ color: "var(--ink-500)" }}>
              <p style={{ fontSize: 14 }}>No uploads or scans in history.</p>
              <p className="mt-1" style={{ fontSize: 13 }}>
                Upload a CSV or run a Health Scan; they will appear here once saved.
              </p>
            </div>
          )}

          {!loading && merged.length > 0 && (
            <div
              className="p-4"
              style={{
                background: "var(--bg-paper)",
                border: "1px solid var(--line-soft)",
                borderRadius: 12,
              }}
            >
              <h3
                className="mb-3"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 18,
                  color: "var(--ink-900)",
                  letterSpacing: "-0.01em",
                }}
              >
                History table
              </h3>
              <div
                className="overflow-x-auto"
                style={{
                  background: "var(--bg-white)",
                  border: "1px solid var(--line-soft)",
                  borderRadius: 10,
                }}
              >
                <table className="cd-table w-full text-sm text-left">
                  <thead>
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3 w-24">Kind</th>
                      <th className="px-4 py-3 w-24">Images</th>
                      <th className="px-4 py-3">CSV uploaded</th>
                      <th className="px-4 py-3 w-24 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merged.map((item) => (
                      <tr key={`${item.type}-${item.id}`}>
                        <td className="px-4 py-3" style={{ color: "var(--ink-700)" }}>
                          {formatDate(item.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1.5"
                            style={{ color: "var(--ink-900)", fontWeight: 500 }}
                          >
                            {item.type === "csv" ? (
                              <><FileSpreadsheet size={16} style={{ color: "var(--sage-ink)" }} /> CSV</>
                            ) : (
                              <><Scan size={16} style={{ color: "var(--blue-ink)" }} /> Health Scan</>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--ink-700)" }}>
                          {item.type === "health_scan" ? `${item.imageCount} image(s)` : "—"}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--ink-900)", fontWeight: 500 }}>
                          {item.type === "csv" ? (
                            <span
                              className="truncate max-w-[200px] inline-block align-bottom"
                              title={item.filename}
                            >
                              {item.filename}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemove(item)}
                            disabled={deletingKey === `${item.type}:${item.id}`}
                            className="inline-flex items-center gap-1"
                            style={{
                              color: "var(--clay-ink)",
                              fontSize: 13,
                              fontWeight: 500,
                              opacity: deletingKey === `${item.type}:${item.id}` ? 0.5 : 1,
                            }}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                            {deletingKey === `${item.type}:${item.id}` ? "…" : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
