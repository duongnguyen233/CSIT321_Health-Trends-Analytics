import { useState, useEffect } from "react";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import {
  getUploadHistory,
  deleteUpload,
  clearUploadHistory,
  getHealthScanHistory,
  deleteHealthScan,
  clearHealthScanHistory,
} from "../../services/api";
import { Trash2, RotateCcw, FileSpreadsheet, Scan } from "lucide-react";

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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 max-w-[1280px] mx-auto gap-6">
        <MyDataSidebar activePage="Uploaded History" />

        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Uploaded History
          </h1>
          <p className="text-gray-600 mb-10">
            History of CSV uploads (Upload Data) and Health Scan records. Same layout as Dashboard. View time, kind, images, and CSV filename below.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            {merged.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={clearing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition disabled:opacity-50"
              >
                <RotateCcw size={16} />
                {clearing ? "Clearing…" : "Clear all history"}
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {loading && (
            <p className="text-center text-gray-500 text-sm mb-6">Loading…</p>
          )}

          {!loading && merged.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              <p className="text-sm">No uploads or scans in history.</p>
              <p className="text-sm mt-1">Upload a CSV (Upload Data) or run a Health Scan; they will appear here once saved.</p>
            </div>
          )}

          {!loading && merged.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">History table</h3>
              <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium w-24">Kind</th>
                      <th className="px-4 py-3 font-medium w-24">Images</th>
                      <th className="px-4 py-3 font-medium">CSV uploaded</th>
                      <th className="px-4 py-3 font-medium w-24 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merged.map((item) => (
                      <tr key={`${item.type}-${item.id}`} className="border-t border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">
                          {formatDate(item.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-gray-900 font-medium">
                            {item.type === "csv" ? (
                              <><FileSpreadsheet size={16} className="text-primary" /> CSV</>
                            ) : (
                              <><Scan size={16} className="text-primary" /> Health Scan</>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {item.type === "health_scan" ? `${item.imageCount} image(s)` : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {item.type === "csv" ? (
                            <span className="truncate max-w-[200px] inline-block align-bottom" title={item.filename}>{item.filename}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemove(item)}
                            disabled={deletingKey === `${item.type}:${item.id}`}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 disabled:opacity-50"
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
