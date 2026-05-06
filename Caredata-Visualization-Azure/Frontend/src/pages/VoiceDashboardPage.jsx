/**
 * VoiceDashboardPage (v2) — nurse-facing dashboard for the redesigned
 * voice biomarker tab. Styled to match QIDashboardPage / ReportsPage:
 * cream page background, cd-surface cards, cd-chip + cd-btn utilities,
 * Instrument Serif h1, sidebar-on-the-left layout.
 */
import { useEffect, useMemo, useState } from "react";

import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import ResidentDetailPanel from "../components/voice/ResidentDetailPanel";
import VoiceAlertsFeed from "../components/voice/VoiceAlertsFeed";
import IssueLinksDialog from "../components/voice/IssueLinksDialog";
import { buildRecordLinkUrl, listAlerts, listResidents } from "../services/voiceApiV2";


const DIMENSIONS = ["phonatory", "articulatory", "prosodic", "respiratory", "linguistic"];
const DIMENSION_SHORT = {
  phonatory: "Phon",
  articulatory: "Art",
  prosodic: "Pros",
  respiratory: "Resp",
  linguistic: "Ling",
};
const DIMENSION_DOT = {
  phonatory: "var(--sage)",
  articulatory: "#95A8BD",
  prosodic: "var(--clay)",
  respiratory: "#A4ACA6",
  linguistic: "#C68C8C",
};

const SIDEBAR_NAV = [
  { id: "all", label: "All residents", hint: "Daily check-ins across the facility" },
  { id: "review", label: "Review alerts", hint: "Severity = review" },
  { id: "watch", label: "Watch alerts", hint: "Severity = watch" },
  { id: "needs_baseline", label: "Needs baseline", hint: "Lock baseline pending" },
];


export default function VoiceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [residents, setResidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  const [openResident, setOpenResident] = useState(null);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("concern_desc");
  const [activeView, setActiveView] = useState("all");

  async function reload() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [r, a] = await Promise.all([
        listResidents(),
        listAlerts({ status: "open", limit: 200, cursor: 0 }),
      ]);
      setResidents(r.residents || []);
      setAlerts(a.alerts || []);
    } catch (e) {
      setErrorMsg(e?.response?.data?.detail || e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const summary = useMemo(
    () => ({
      total: residents.length,
      baselined: residents.filter((r) => !!r.baseline_locked_at).length,
      review: alerts.filter((a) => a.severity === "review").length,
      watch: alerts.filter((a) => a.severity === "watch").length,
    }),
    [residents, alerts]
  );

  const alertsByProfile = useMemo(() => {
    const map = {};
    for (const a of alerts) {
      if (!a.profile_id) continue;
      if (!map[a.profile_id]) map[a.profile_id] = { watch: 0, review: 0 };
      if (a.severity === "watch") map[a.profile_id].watch += 1;
      if (a.severity === "review") map[a.profile_id].review += 1;
    }
    return map;
  }, [alerts]);

  const filtered = useMemo(() => {
    let rows = residents.slice();
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.display_name || "").toLowerCase().includes(q) ||
          (r.resident_id || "").toLowerCase().includes(q)
      );
    }
    if (activeView === "review") {
      const flagged = new Set(
        alerts.filter((a) => a.severity === "review").map((a) => a.profile_id)
      );
      rows = rows.filter((r) => flagged.has(r.profile_id));
    } else if (activeView === "watch") {
      const flagged = new Set(
        alerts.filter((a) => a.severity === "watch").map((a) => a.profile_id)
      );
      rows = rows.filter((r) => flagged.has(r.profile_id));
    } else if (activeView === "needs_baseline") {
      rows = rows.filter((r) => !r.baseline_locked_at);
    }
    rows.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return (a.display_name || "").localeCompare(b.display_name || "");
        case "name_desc":
          return (b.display_name || "").localeCompare(a.display_name || "");
        case "concern_asc":
          return (a.latest_concern_score || 0) - (b.latest_concern_score || 0);
        case "concern_desc":
        default:
          return (b.latest_concern_score || 0) - (a.latest_concern_score || 0);
      }
    });
    return rows;
  }, [residents, alerts, search, activeView, sortBy]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-cream)" }}
    >
      <Navbar />
      <main className="flex flex-grow pt-24 pb-12 px-4 sm:px-8 max-w-[1440px] mx-auto gap-6 w-full">
        {/* Sidebar */}
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          summary={summary}
          onIssueLinks={() => setIssueDialogOpen(true)}
        />

        {/* Main column */}
        <div className="flex-1 min-w-0">
          <PageHeader
            quarterLabel={`${residents.length} resident${
              residents.length === 1 ? "" : "s"
            }`}
            onIssueLinks={() => setIssueDialogOpen(true)}
            onRefresh={reload}
            loading={loading}
          />

          <SummaryRow summary={summary} />

          <FiltersBar
            search={search}
            setSearch={setSearch}
            sortBy={sortBy}
            setSortBy={setSortBy}
          />

          {errorMsg && (
            <div
              className="text-sm rounded-md p-3 mb-3"
              style={{
                background: "#FBE9E9",
                color: "#7A2424",
                border: "1px solid #E8B7B7",
              }}
            >
              {typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg)}
            </div>
          )}

          <ResidentsTable
            rows={filtered}
            alertsByProfile={alertsByProfile}
            loading={loading}
            onOpen={setOpenResident}
            onIssueLink={(r) =>
              setIssueDialogOpen({ preselect: [r.resident_id] })
            }
          />
        </div>

        {/* Right column: alerts feed */}
        <aside className="w-[320px] shrink-0 hidden xl:block">
          <VoiceAlertsFeed
            alerts={alerts}
            residents={residents}
            onOpen={setOpenResident}
            onAfterAck={reload}
          />
        </aside>
      </main>
      <Footer />

      {openResident && (
        <ResidentDetailPanel
          resident={openResident}
          onClose={() => setOpenResident(null)}
          onAckedAlert={reload}
          onBaselineLocked={reload}
        />
      )}

      {issueDialogOpen && (
        <IssueLinksDialog
          residents={residents}
          preselect={
            typeof issueDialogOpen === "object" ? issueDialogOpen.preselect : []
          }
          onClose={() => setIssueDialogOpen(false)}
          onIssued={reload}
        />
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------


function Sidebar({ activeView, setActiveView, summary, onIssueLinks }) {
  const counts = {
    all: summary.total,
    review: summary.review,
    watch: summary.watch,
    needs_baseline: Math.max(0, summary.total - summary.baselined),
  };
  return (
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
        Voice screening
      </p>
      <ul className="space-y-0.5 mb-4">
        {SIDEBAR_NAV.map((nav) => {
          const isActive = activeView === nav.id;
          const c = counts[nav.id] ?? 0;
          return (
            <li key={nav.id}>
              <button
                type="button"
                onClick={() => setActiveView(nav.id)}
                className="w-full flex items-center gap-2.5 transition text-left"
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? "var(--ink-900)" : "var(--ink-700)",
                  background: isActive ? "var(--bg-sage-tint)" : "transparent",
                  boxShadow: isActive ? "inset 0 0 0 1px var(--sage)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "var(--bg-cream)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <span className="flex-1">{nav.label}</span>
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-500)",
                  }}
                >
                  {c}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div
        className="mx-1 my-3"
        style={{ borderTop: "1px solid var(--line-soft)" }}
      />

      <div className="px-2">
        <p
          className="uppercase mb-2"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "var(--ink-500)",
          }}
        >
          Quick actions
        </p>
        <button
          type="button"
          onClick={onIssueLinks}
          className="cd-btn cd-btn-primary w-full justify-center"
          style={{ fontSize: 13, padding: "9px 12px" }}
        >
          Resident links
        </button>
        <p
          className="mt-2"
          style={{ fontSize: 11, color: "var(--ink-500)", lineHeight: 1.4 }}
        >
          One permanent link per resident. Copy and share once — they
          reuse the same URL for every daily check-in.
        </p>
      </div>
    </aside>
  );
}


// ---------------------------------------------------------------------------
// Page header (matches QI/Reports headers)
// ---------------------------------------------------------------------------


function PageHeader({ quarterLabel, onIssueLinks, onRefresh, loading }) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <span className="cd-chip mb-3">
          <span className="dot" />
          Facility · {quarterLabel}
        </span>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(30px, 4vw, 42px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: "var(--ink-900)",
            marginTop: 8,
          }}
        >
          Voice screening
        </h1>
        <p className="mt-2" style={{ color: "var(--ink-500)", fontSize: 14 }}>
          Daily voice check-ins flagged for nurse review across the facility.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onIssueLinks}
          className="cd-btn cd-btn-primary"
          style={{ fontSize: 13 }}
        >
          Resident links
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="cd-btn cd-btn-ghost"
          style={{ fontSize: 13 }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
  );
}


function SummaryRow({ summary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      <Kpi label="Residents" value={summary.total} tint="sage" />
      <Kpi label="Baselined" value={summary.baselined} tint="blue" />
      <Kpi label="Watch alerts" value={summary.watch} tint="warn" />
      <Kpi label="Review alerts" value={summary.review} tint="bad" />
    </div>
  );
}


function Kpi({ label, value, tint }) {
  const bg =
    tint === "sage"
      ? "var(--bg-sage-tint)"
      : tint === "blue"
      ? "var(--bg-blue-tint)"
      : tint === "warn"
      ? "#F4E5C9"
      : tint === "bad"
      ? "#F4D7D7"
      : "var(--bg-paper)";
  return (
    <div
      style={{
        background: "var(--bg-white)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: 16,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          style={{
            fontSize: 11,
            color: "var(--ink-500)",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </span>
        <span
          className="rounded-full"
          style={{
            width: 8,
            height: 8,
            background:
              tint === "warn" ? "#D4AC83" : tint === "bad" ? "#C68C8C" : tint === "blue" ? "var(--blue)" : "var(--sage)",
          }}
        />
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 32,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--ink-900)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}


function FiltersBar({ search, setSearch, sortBy, setSortBy }) {
  return (
    <div
      className="flex flex-wrap gap-2 items-center mb-3"
      style={{
        background: "var(--bg-white)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: 12,
      }}
    >
      <input
        type="search"
        placeholder="Search by name or ID"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="flex-1 min-w-[180px]"
        style={{
          background: "var(--bg-paper)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 13,
          color: "var(--ink-900)",
        }}
      />
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        style={{
          background: "var(--bg-white)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "8px 10px",
          fontSize: 13,
          color: "var(--ink-700)",
        }}
      >
        <option value="concern_desc">Concern (high → low)</option>
        <option value="concern_asc">Concern (low → high)</option>
        <option value="name_asc">Name (A → Z)</option>
        <option value="name_desc">Name (Z → A)</option>
      </select>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------


function ResidentsTable({ rows, alertsByProfile, loading, onOpen, onIssueLink }) {
  if (loading) {
    return (
      <div
        className="text-sm"
        style={{
          background: "var(--bg-white)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
          padding: 32,
          color: "var(--ink-500)",
        }}
      >
        Loading residents…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div
        className="text-sm"
        style={{
          background: "var(--bg-white)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
          padding: 32,
          color: "var(--ink-500)",
        }}
      >
        No residents match the current filter.
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto"
      style={{
        background: "var(--bg-white)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
      }}
    >
      <table className="cd-table" style={{ tableLayout: "auto" }}>
        <thead>
          <tr
            style={{
              borderBottom: "1px solid var(--line-soft)",
              color: "var(--ink-500)",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <th style={cellHead("left", 16, 12)}>Resident</th>
            <th style={cellHead("left", 12, 12)}>Concern</th>
            <th style={cellHead("left", 12, 12)}>Sub-scores</th>
            <th style={cellHead("left", 12, 12)}>Alerts</th>
            <th style={cellHead("left", 12, 12)}>Last check-in</th>
            <th style={cellHead("right", 16, 12)}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const subs = r.latest_subscores || {};
            const concern = r.latest_concern_score;
            const counts = alertsByProfile[r.profile_id] || { watch: 0, review: 0 };
            return (
              <tr
                key={r.profile_id}
                onClick={() => onOpen(r)}
                style={{
                  borderBottom: "1px solid var(--line-soft)",
                  cursor: "pointer",
                  transition: "background .15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-paper)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={cellBody(16, 14)}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-900)" }}>
                    {r.display_name || r.resident_id}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>
                    {r.resident_id}
                    {r.baseline_locked_at && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "1px 6px",
                          borderRadius: 999,
                          background: "var(--bg-sage-tint)",
                          color: "var(--sage-ink)",
                          fontSize: 10,
                        }}
                      >
                        baseline v{r.baseline_version}
                      </span>
                    )}
                  </div>
                </td>
                <td style={cellBody(12, 14)}>
                  <ConcernBadge value={concern} />
                </td>
                <td style={cellBody(12, 14)}>
                  <div className="flex flex-wrap gap-1">
                    {DIMENSIONS.map((d) => (
                      <DimMini key={d} dim={d} value={subs[d]} />
                    ))}
                  </div>
                </td>
                <td style={cellBody(12, 14)}>
                  <div className="flex gap-1">
                    {counts.review > 0 && (
                      <SeverityBadge severity="review" count={counts.review} />
                    )}
                    {counts.watch > 0 && (
                      <SeverityBadge severity="watch" count={counts.watch} />
                    )}
                    {counts.review === 0 && counts.watch === 0 && (
                      <span style={{ fontSize: 11, color: "var(--ink-300)" }}>none</span>
                    )}
                  </div>
                </td>
                <td style={cellBody(12, 14)}>
                  <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                    {r.last_recording_date ? r.last_recording_date.slice(0, 10) : "—"}
                  </span>
                </td>
                <td style={{ ...cellBody(16, 14), textAlign: "right" }}>
                  <div className="flex justify-end gap-3">
                    <CopyLinkButton resident={r} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(r);
                      }}
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--ink-900)",
                        textDecoration: "underline",
                      }}
                    >
                      Open
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function cellHead(align, padX, padY) {
  return {
    padding: `${padY}px ${padX}px`,
    textAlign: align,
    fontWeight: 600,
  };
}


function cellBody(padX, padY) {
  return {
    padding: `${padY}px ${padX}px`,
    verticalAlign: "middle",
  };
}


function CopyLinkButton({ resident }) {
  const [copied, setCopied] = useState(false);
  const token = resident.persistent_link_token;
  if (!token) return null;
  const url = buildRecordLinkUrl(token);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      title={url}
      style={{
        fontSize: 12,
        fontWeight: 500,
        color: copied ? "var(--sage-ink)" : "var(--ink-700)",
        textDecoration: "underline",
      }}
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}


function ConcernBadge({ value }) {
  if (value == null)
    return <span style={{ fontSize: 12, color: "var(--ink-300)" }}>—</span>;
  const v = Math.round(value);
  let bg = "var(--bg-cream)";
  let fg = "var(--ink-900)";
  if (v >= 80) {
    bg = "#F4D7D7";
    fg = "#7A2424";
  } else if (v >= 70) {
    bg = "#F4E5C9";
    fg = "#7A5A1F";
  } else if (v >= 40) {
    bg = "var(--bg-sage-tint)";
    fg = "var(--sage-ink)";
  }
  return (
    <span
      className="tabular-nums"
      style={{
        fontSize: 13,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 6,
        background: bg,
        color: fg,
        fontFamily: "var(--font-serif)",
      }}
    >
      {v}
    </span>
  );
}


function DimMini({ dim, value }) {
  const v = value == null ? null : Math.round(value);
  const dot = DIMENSION_DOT[dim] || "var(--ink-300)";
  return (
    <span
      title={`${dim}: ${v == null ? "—" : v}`}
      className="tabular-nums"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        padding: "2px 6px",
        borderRadius: 999,
        background: "var(--bg-paper)",
        border: "1px solid var(--line-soft)",
        color: "var(--ink-700)",
      }}
    >
      <span
        className="rounded-full"
        style={{ width: 5, height: 5, background: dot }}
      />
      {DIMENSION_SHORT[dim]} {v == null ? "—" : v}
    </span>
  );
}


function SeverityBadge({ severity, count }) {
  const styles = {
    watch: { bg: "#F4E5C9", fg: "#7A5A1F" },
    review: { bg: "#F4D7D7", fg: "#7A2424" },
  };
  const s = styles[severity] || { bg: "var(--bg-cream)", fg: "var(--ink-700)" };
  return (
    <span
      style={{
        fontSize: 10,
        textTransform: "uppercase",
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        letterSpacing: "0.04em",
      }}
    >
      {severity}
      {count > 1 ? ` × ${count}` : ""}
    </span>
  );
}
