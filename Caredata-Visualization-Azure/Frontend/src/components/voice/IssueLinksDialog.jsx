/**
 * ResidentLinksDialog — manage every resident's persistent recording link.
 *
 * The token model in v2 is one-link-per-resident-forever. The nurse opens
 * this dialog to copy a resident's URL (to email/print/SMS to them); they
 * never need to "issue" anything. New residents are enrolled inline; the
 * backend creates the profile + the persistent link in one step.
 *
 * (File still named IssueLinksDialog.jsx for backwards compatibility with
 * existing imports — the component name changed.)
 */
import { useEffect, useState } from "react";

import {
  buildRecordLinkUrl,
  createResident,
} from "../../services/voiceApiV2";


export default function IssueLinksDialog({ residents, preselect = [], onClose, onIssued }) {
  const [residentList, setResidentList] = useState(residents);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newResidentId, setNewResidentId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [copied, setCopied] = useState(null); // resident_id whose URL was just copied
  const [search, setSearch] = useState("");

  // Highlight a particular resident on open (e.g. opened via a per-row action)
  const initialHighlight = preselect[0] || null;

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

  async function copyUrl(url, residentId) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(residentId);
      setTimeout(() => setCopied((c) => (c === residentId ? null : c)), 1800);
    } catch {
      /* ignore */
    }
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
      // Pretend a fresh row exists locally so the user sees instant feedback.
      // The persistent_link_token will land via onIssued() -> parent reload.
      const next = residentList.filter((r) => r.resident_id !== profile.resident_id);
      next.unshift({
        profile_id: profile.profile_id,
        resident_id: profile.resident_id,
        display_name: profile.display_name,
        baseline_locked_at: null,
        baseline_version: 0,
        last_recording_date: null,
        latest_concern_score: null,
        latest_subscores: null,
        persistent_link_token: null, // will fill in when parent reloads
      });
      setResidentList(next);
      setNewResidentId("");
      setNewDisplayName("");
      setShowAddForm(false);
      onIssued?.();
    } catch (err) {
      setAddError(
        err?.response?.data?.detail || err?.message || "Failed to add resident."
      );
    } finally {
      setAdding(false);
    }
  }

  const filtered = search
    ? residentList.filter(
        (r) =>
          (r.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
          (r.resident_id || "").toLowerCase().includes(search.toLowerCase())
      )
    : residentList;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-label="Resident recording links"
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
              Resident recording links
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 4 }}>
              Each resident has one permanent link they reuse every day.
              Copy it once, share it with them (email / print / SMS) — they
              keep using the same URL for every check-in.
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

        <div className="flex-1 overflow-y-auto" style={{ padding: "16px 22px" }}>
          {/* Add a new resident */}
          {showAddForm ? (
            <form
              onSubmit={handleAddResident}
              style={{
                background: "var(--bg-sage-tint)",
                border: "1px solid var(--line-soft)",
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
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
                Enrol a new resident
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <label className="flex-1 min-w-[140px]">
                  <span style={fieldLabelStyle}>Resident ID</span>
                  <input
                    type="text"
                    value={newResidentId}
                    onChange={(e) => setNewResidentId(e.target.value)}
                    autoFocus
                    placeholder="e.g. R-V005"
                    style={fieldInputStyle}
                  />
                </label>
                <label className="flex-1 min-w-[160px]">
                  <span style={fieldLabelStyle}>Display name</span>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="e.g. Joan Wilson"
                    style={fieldInputStyle}
                  />
                </label>
                <button
                  type="submit"
                  disabled={adding}
                  className="cd-btn cd-btn-primary"
                  style={{ fontSize: 12, padding: "7px 12px" }}
                >
                  {adding ? "Adding…" : "Add + create link"}
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
                <div style={{ fontSize: 12, color: "#7A2424", marginTop: 6 }}>
                  {addError}
                </div>
              )}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="cd-btn cd-btn-soft mb-3"
              style={{
                fontSize: 12,
                padding: "8px 12px",
                width: "100%",
                justifyContent: "center",
              }}
            >
              + Enrol a new resident
            </button>
          )}

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or ID"
            style={{
              ...fieldInputStyle,
              background: "var(--bg-paper)",
              marginBottom: 8,
            }}
          />

          {/* Resident list */}
          {filtered.length === 0 ? (
            <div
              style={{
                padding: 16,
                fontSize: 13,
                color: "var(--ink-500)",
                fontStyle: "italic",
                background: "var(--bg-paper)",
                border: "1px solid var(--line-soft)",
                borderRadius: 12,
              }}
            >
              {residentList.length === 0
                ? "No residents yet. Enrol one above to get started."
                : "No matches."}
            </div>
          ) : (
            <ul
              style={{
                border: "1px solid var(--line-soft)",
                borderRadius: 12,
                background: "var(--bg-paper)",
                overflow: "hidden",
              }}
            >
              {filtered.map((r, i) => {
                const url = r.persistent_link_token
                  ? buildRecordLinkUrl(r.persistent_link_token)
                  : null;
                const highlight = r.resident_id === initialHighlight;
                return (
                  <li
                    key={r.resident_id}
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
                      padding: "12px 14px",
                      background: highlight
                        ? "var(--bg-sage-tint)"
                        : "transparent",
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            color: "var(--ink-900)",
                            fontWeight: 500,
                          }}
                        >
                          {r.display_name || r.resident_id}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-500)" }}>
                          {r.resident_id}
                          {r.last_recording_date && (
                            <span style={{ marginLeft: 8 }}>
                              · last check-in {r.last_recording_date.slice(0, 10)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {url ? (
                      <div className="flex items-center gap-2">
                        <code
                          className="flex-1 truncate"
                          title={url}
                          style={{
                            fontSize: 11,
                            color: "var(--ink-700)",
                            background: "var(--bg-white)",
                            border: "1px solid var(--line-soft)",
                            borderRadius: 6,
                            padding: "5px 8px",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {url}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyUrl(url, r.resident_id)}
                          className="cd-btn cd-btn-soft"
                          style={{ fontSize: 11, padding: "5px 12px" }}
                        >
                          {copied === r.resident_id ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--ink-500)",
                          fontStyle: "italic",
                        }}
                      >
                        Link will be generated when the parent dashboard refreshes.
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          className="flex items-center justify-end"
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--line-soft)",
            background: "var(--bg-paper)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="cd-btn cd-btn-primary"
            style={{ fontSize: 13 }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}


const fieldLabelStyle = {
  fontSize: 11,
  color: "var(--ink-700)",
  fontWeight: 500,
  display: "block",
  marginBottom: 4,
};

const fieldInputStyle = {
  background: "var(--bg-white)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 13,
  color: "var(--ink-900)",
  width: "100%",
};
