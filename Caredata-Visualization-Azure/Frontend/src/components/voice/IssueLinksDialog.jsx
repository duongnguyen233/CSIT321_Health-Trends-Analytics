/**
 * IssueLinksDialog — modal for batch (or per-resident) link issuing.
 *
 * Lets the nurse pick one or many residents, choose a target date
 * (default today), and issue per-resident recording links via the v2
 * idempotent issue-link endpoint. Shows the resulting URLs with copy
 * buttons.
 */
import { useEffect, useState } from "react";

import {
  buildRecordLinkUrl,
  createResident,
  issueLink,
} from "../../services/voiceApiV2";


function todayIso() {
  return new Date().toISOString().slice(0, 10);
}


export default function IssueLinksDialog({
  residents,
  preselect = [],
  onClose,
  onIssued,
}) {
  const [residentList, setResidentList] = useState(residents);
  const [selected, setSelected] = useState(() => new Set(preselect));
  const [targetDate, setTargetDate] = useState(todayIso());
  const [issued, setIssued] = useState([]); // [{resident_id, display_name, url}]
  const [issuing, setIssuing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Inline "add new resident" form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newResidentId, setNewResidentId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);

  // Keep local list in sync if parent reloads
  useEffect(() => {
    setResidentList(residents);
  }, [residents]);

  // Esc-to-close
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(rid) {
    const next = new Set(selected);
    if (next.has(rid)) next.delete(rid);
    else next.add(rid);
    setSelected(next);
  }

  function selectAll() {
    setSelected(new Set(residentList.map((r) => r.resident_id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function handleAddResident(e) {
    e?.preventDefault?.();
    const rid = newResidentId.trim();
    const name = newDisplayName.trim();
    if (!rid || !name) {
      setAddError("Please enter both an ID and a display name.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const profile = await createResident({
        resident_id: rid,
        display_name: name,
      });
      // Insert (or replace) in the local list
      const next = residentList.filter(
        (r) => r.resident_id !== profile.resident_id
      );
      next.unshift({
        profile_id: profile.profile_id,
        resident_id: profile.resident_id,
        display_name: profile.display_name,
        baseline_locked_at: null,
        baseline_version: 0,
        last_recording_date: null,
        latest_concern_score: null,
        latest_subscores: null,
      });
      setResidentList(next);
      // Auto-select
      const nextSelected = new Set(selected);
      nextSelected.add(profile.resident_id);
      setSelected(nextSelected);
      // Reset form
      setNewResidentId("");
      setNewDisplayName("");
      setShowAddForm(false);
      // Tell parent to reload its master list
      onIssued?.();
    } catch (err) {
      setAddError(err?.response?.data?.detail || err?.message || "Failed to add resident.");
    } finally {
      setAdding(false);
    }
  }

  async function handleIssue() {
    setIssuing(true);
    setErrorMsg(null);
    setIssued([]);
    const out = [];
    try {
      for (const rid of selected) {
        const r = residentList.find((x) => x.resident_id === rid);
        const link = await issueLink(rid, targetDate);
        out.push({
          resident_id: rid,
          display_name: r?.display_name || rid,
          url: buildRecordLinkUrl(link.token),
          token: link.token,
        });
      }
      setIssued(out);
      onIssued?.();
    } catch (e) {
      setErrorMsg(e?.message || "Failed to issue link.");
    } finally {
      setIssuing(false);
    }
  }

  async function copyUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-label="Issue recording links"
      style={{ background: "rgba(31, 38, 34, 0.4)" }}
    >
      <div
        className="w-full max-w-2xl mx-4"
        style={{
          background: "var(--bg-white)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-4"
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--line-soft)",
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                letterSpacing: "-0.01em",
                color: "var(--ink-900)",
                lineHeight: 1.2,
              }}
            >
              Issue recording links
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "var(--ink-500)",
                marginTop: 4,
              }}
            >
              Pick the residents who should record today. We&rsquo;ll generate
              one link per resident.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              fontSize: 22,
              lineHeight: 1,
              color: "var(--ink-500)",
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "16px 22px" }}>
          {issued.length === 0 ? (
            <>
              {/* Date picker */}
              <div className="flex items-center gap-3 mb-4">
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--ink-700)",
                    fontWeight: 500,
                  }}
                >
                  Valid for date
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  style={{
                    background: "var(--bg-paper)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 13,
                    color: "var(--ink-900)",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-500)",
                  }}
                >
                  (Today by default. Idempotent — re-issuing returns the same token.)
                </span>
              </div>

              {/* New-resident inline form */}
              {showAddForm ? (
                <form
                  onSubmit={handleAddResident}
                  style={{
                    background: "var(--bg-sage-tint)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--sage-ink)",
                      marginBottom: 6,
                    }}
                  >
                    Add a new resident
                  </p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <label className="flex-1 min-w-[140px]">
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--ink-700)",
                          fontWeight: 500,
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Resident ID
                      </span>
                      <input
                        type="text"
                        value={newResidentId}
                        onChange={(e) => setNewResidentId(e.target.value)}
                        autoFocus
                        placeholder="e.g. R-V005"
                        style={{
                          background: "var(--bg-white)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          padding: "7px 10px",
                          fontSize: 13,
                          color: "var(--ink-900)",
                          width: "100%",
                        }}
                      />
                    </label>
                    <label className="flex-1 min-w-[160px]">
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--ink-700)",
                          fontWeight: 500,
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        Display name
                      </span>
                      <input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        placeholder="e.g. Joan Wilson"
                        style={{
                          background: "var(--bg-white)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          padding: "7px 10px",
                          fontSize: 13,
                          color: "var(--ink-900)",
                          width: "100%",
                        }}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={adding}
                      className="cd-btn cd-btn-primary"
                      style={{ fontSize: 12, padding: "7px 12px" }}
                    >
                      {adding ? "Adding…" : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setAddError(null);
                      }}
                      className="cd-btn cd-btn-ghost"
                      style={{ fontSize: 12, padding: "7px 12px" }}
                    >
                      Cancel
                    </button>
                  </div>
                  {addError && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#7A2424",
                        marginTop: 6,
                      }}
                    >
                      {addError}
                    </div>
                  )}
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="cd-btn cd-btn-soft mb-2"
                  style={{
                    fontSize: 12,
                    padding: "7px 12px",
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  + Add a new resident
                </button>
              )}

              {/* Select-all toolbar */}
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                  {selected.size} of {residentList.length} selected
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    style={{
                      fontSize: 12,
                      color: "var(--ink-700)",
                      textDecoration: "underline",
                    }}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    style={{
                      fontSize: 12,
                      color: "var(--ink-500)",
                      textDecoration: "underline",
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Resident list */}
              <ul
                style={{
                  border: "1px solid var(--line-soft)",
                  borderRadius: 12,
                  background: "var(--bg-paper)",
                  overflow: "hidden",
                }}
              >
                {residentList.length === 0 && (
                  <li
                    style={{
                      padding: 16,
                      fontSize: 13,
                      color: "var(--ink-500)",
                      fontStyle: "italic",
                    }}
                  >
                    No residents yet.
                  </li>
                )}
                {residentList.map((r) => {
                  const checked = selected.has(r.resident_id);
                  return (
                    <li
                      key={r.resident_id}
                      style={{
                        borderTop: "1px solid var(--line-soft)",
                      }}
                    >
                      <label
                        className="flex items-center gap-3 cursor-pointer"
                        style={{
                          padding: "10px 14px",
                          background: checked ? "var(--bg-sage-tint)" : "transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(r.resident_id)}
                          className="accent-current"
                          style={{ accentColor: "var(--sage-ink)" }}
                        />
                        <div className="flex-1">
                          <div
                            style={{
                              fontSize: 14,
                              color: "var(--ink-900)",
                              fontWeight: 500,
                            }}
                          >
                            {r.display_name || r.resident_id}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--ink-500)",
                            }}
                          >
                            {r.resident_id}
                            {r.last_recording_date &&
                              ` · last check-in ${r.last_recording_date.slice(0, 10)}`}
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>

              {errorMsg && (
                <div
                  className="mt-3"
                  style={{
                    background: "#FBE9E9",
                    color: "#7A2424",
                    border: "1px solid #E8B7B7",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                  }}
                >
                  {errorMsg}
                </div>
              )}
            </>
          ) : (
            <IssuedResults issued={issued} onCopy={copyUrl} />
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2"
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--line-soft)",
            background: "var(--bg-paper)",
          }}
        >
          {issued.length === 0 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="cd-btn cd-btn-ghost"
                style={{ fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIssue}
                disabled={issuing || selected.size === 0}
                className="cd-btn cd-btn-primary"
                style={{ fontSize: 13, opacity: selected.size === 0 ? 0.5 : 1 }}
              >
                {issuing
                  ? "Issuing…"
                  : `Issue ${selected.size} link${selected.size === 1 ? "" : "s"}`}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="cd-btn cd-btn-primary"
              style={{ fontSize: 13 }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


function IssuedResults({ issued, onCopy }) {
  const allText = issued
    .map((x) => `${x.display_name}\t${x.url}`)
    .join("\n");

  return (
    <div>
      <p
        style={{
          fontSize: 13,
          color: "var(--ink-700)",
          marginBottom: 12,
        }}
      >
        Done — copy each URL or all at once. Each link is single-use and
        scoped to today.
      </p>
      <ul
        style={{
          border: "1px solid var(--line-soft)",
          borderRadius: 12,
          background: "var(--bg-paper)",
          overflow: "hidden",
        }}
      >
        {issued.map((x) => (
          <li
            key={x.token}
            style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--line-soft)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-900)",
                fontWeight: 500,
              }}
            >
              {x.display_name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <code
                className="flex-1 truncate"
                style={{
                  fontSize: 11,
                  color: "var(--ink-500)",
                  background: "var(--bg-white)",
                  border: "1px solid var(--line-soft)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontFamily: "var(--font-mono)",
                }}
                title={x.url}
              >
                {x.url}
              </code>
              <button
                type="button"
                onClick={() => onCopy(x.url)}
                className="cd-btn cd-btn-soft"
                style={{ fontSize: 11, padding: "4px 10px" }}
              >
                Copy
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onCopy(allText)}
        className="cd-btn cd-btn-ghost"
        style={{ fontSize: 12, padding: "6px 12px", marginTop: 12 }}
      >
        Copy all (name + URL, tab-separated)
      </button>
    </div>
  );
}
