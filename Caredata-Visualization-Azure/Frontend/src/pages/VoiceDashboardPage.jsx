/**
 * VoiceDashboardPage (v2) — nurse-facing dashboard for the redesigned
 * voice biomarker tab.
 *
 * Layout:
 *   Header  : facility summary chips + global "Issue daily links" CTA
 *   Filters : search box + severity filter
 *   Table   : sortable list of residents with concern + sub-score chips
 *             + actions (open detail / issue link)
 *   Drawer  : ResidentDetailPanel (sub-score sparklines, alerts, audio,
 *             lock-baseline)
 */
import { useEffect, useMemo, useState } from "react";

import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import ResidentDetailPanel from "../components/voice/ResidentDetailPanel";
import VoiceAlertsFeed from "../components/voice/VoiceAlertsFeed";
import { listAlerts, listResidents } from "../services/voiceApiV2";


const DIMENSIONS = ["phonatory", "articulatory", "prosodic", "respiratory", "linguistic"];
const DIMENSION_LABEL = {
  phonatory: "Phon",
  articulatory: "Art",
  prosodic: "Pros",
  respiratory: "Resp",
  linguistic: "Ling",
};


export default function VoiceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [residents, setResidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [openResident, setOpenResident] = useState(null);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("concern_desc");
  const [severityFilter, setSeverityFilter] = useState("all");

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

  const summary = useMemo(() => {
    return {
      total: residents.length,
      baselined: residents.filter((r) => !!r.baseline_locked_at).length,
      review: alerts.filter((a) => a.severity === "review").length,
      watch: alerts.filter((a) => a.severity === "watch").length,
    };
  }, [residents, alerts]);

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
    if (severityFilter !== "all") {
      const flagged = new Set(
        alerts
          .filter((a) => a.severity === severityFilter)
          .map((a) => a.profile_id)
      );
      rows = rows.filter((r) => flagged.has(r.profile_id));
    }
    rows.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return (a.display_name || "").localeCompare(b.display_name || "");
        case "name_desc":
          return (b.display_name || "").localeCompare(a.display_name || "");
        case "concern_asc":
          return (
            (a.latest_concern_score || 0) - (b.latest_concern_score || 0)
          );
        case "concern_desc":
        default:
          return (
            (b.latest_concern_score || 0) - (a.latest_concern_score || 0)
          );
      }
    });
    return rows;
  }, [residents, alerts, search, severityFilter, sortBy]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-paper)" }}
    >
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 mt-16">
        <Header summary={summary} onRefresh={reload} loading={loading} />

        <div className="grid grid-cols-1 xl:grid-cols-[1fr,320px] gap-6 mt-6">
          {/* Main column: filters + table */}
          <div>
            <Filters
              search={search}
              setSearch={setSearch}
              sortBy={sortBy}
              setSortBy={setSortBy}
              severityFilter={severityFilter}
              setSeverityFilter={setSeverityFilter}
            />
            {errorMsg && (
              <div className="bg-red-50 border border-red-100 text-red-800 text-sm rounded-md p-3 my-3">
                {typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg)}
              </div>
            )}
            <ResidentsTable
              rows={filtered}
              alerts={alerts}
              loading={loading}
              onOpen={(r) => setOpenResident(r)}
            />
          </div>

          {/* Side column: alerts feed */}
          <aside>
            <VoiceAlertsFeed
              alerts={alerts}
              residents={residents}
              onOpen={(r) => setOpenResident(r)}
              onAfterAck={reload}
            />
          </aside>
        </div>
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
    </div>
  );
}


function Header({ summary, onRefresh, loading }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 leading-tight">
          Voice Screening
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Daily voice check-ins flagged for nurse review across the facility.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Chip label="Residents" value={summary.total} />
        <Chip label="Baselined" value={summary.baselined} />
        <Chip label="Watch" value={summary.watch} tone="warn" />
        <Chip label="Review" value={summary.review} tone="bad" />
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-xs font-semibold underline text-gray-700 hover:text-gray-900 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
  );
}


function Chip({ label, value, tone }) {
  const tones = {
    warn: { bg: "#F4E5C9", fg: "#7A5A1F" },
    bad: { bg: "#F4D7D7", fg: "#7A2424" },
  };
  const t = tones[tone] || { bg: "var(--bg-cream)", fg: "var(--ink-900)" };
  return (
    <div
      className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-baseline gap-1.5"
      style={{ background: t.bg, color: t.fg }}
    >
      <span className="text-sm font-bold tabular-nums">{value}</span>
      <span>{label}</span>
    </div>
  );
}


function Filters({ search, setSearch, sortBy, setSortBy, severityFilter, setSeverityFilter }) {
  return (
    <div className="flex flex-wrap gap-2 items-center bg-white border border-gray-100 rounded-lg p-3">
      <input
        type="search"
        placeholder="Search by name or ID"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="flex-1 min-w-[180px] px-3 py-2 border border-gray-100 rounded-md text-sm"
        style={{ background: "var(--bg-paper)" }}
      />
      <select
        value={severityFilter}
        onChange={(e) => setSeverityFilter(e.target.value)}
        className="px-2 py-2 border border-gray-100 rounded-md text-sm bg-white"
      >
        <option value="all">All residents</option>
        <option value="review">With review alerts</option>
        <option value="watch">With watch alerts</option>
      </select>
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        className="px-2 py-2 border border-gray-100 rounded-md text-sm bg-white"
      >
        <option value="concern_desc">Concern (high → low)</option>
        <option value="concern_asc">Concern (low → high)</option>
        <option value="name_asc">Name (A → Z)</option>
        <option value="name_desc">Name (Z → A)</option>
      </select>
    </div>
  );
}


function ResidentsTable({ rows, alerts, loading, onOpen }) {
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

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-lg p-8 text-sm text-gray-500 mt-3">
        Loading residents…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-lg p-8 text-sm text-gray-500 mt-3">
        No residents match the current filter.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white border border-gray-100 rounded-lg mt-3">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
            <th className="text-left font-semibold px-4 py-3">Resident</th>
            <th className="text-left font-semibold px-3 py-3">Concern</th>
            <th className="text-left font-semibold px-3 py-3">Sub-scores</th>
            <th className="text-left font-semibold px-3 py-3">Alerts</th>
            <th className="text-left font-semibold px-3 py-3">Last check-in</th>
            <th className="text-right font-semibold px-4 py-3"></th>
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
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => onOpen(r)}
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">
                    {r.display_name || r.resident_id}
                  </div>
                  <div className="text-xs text-gray-500">
                    {r.resident_id}
                    {r.baseline_locked_at && (
                      <span className="ml-2">· baseline v{r.baseline_version}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <ConcernBadge value={concern} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {DIMENSIONS.map((d) => (
                      <DimMini key={d} dim={d} value={subs[d]} />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1">
                    {counts.review > 0 && (
                      <SeverityBadge severity="review" count={counts.review} />
                    )}
                    {counts.watch > 0 && (
                      <SeverityBadge severity="watch" count={counts.watch} />
                    )}
                    {counts.review === 0 && counts.watch === 0 && (
                      <span className="text-xs text-gray-400">none</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-600">
                  {r.last_recording_date
                    ? r.last_recording_date.slice(0, 10)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(r);
                    }}
                    className="text-xs font-semibold text-gray-700 underline hover:text-gray-900"
                  >
                    Open
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function ConcernBadge({ value }) {
  if (value == null) return <span className="text-xs text-gray-400">—</span>;
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
    bg = "#E7F1EA";
    fg = "#3D5746";
  }
  return (
    <span
      className="text-xs font-semibold px-2 py-1 rounded-md tabular-nums"
      style={{ background: bg, color: fg }}
    >
      {v}
    </span>
  );
}


function DimMini({ dim, value }) {
  const v = value == null ? null : Math.round(value);
  const colours = {
    phonatory: "#8AA791",
    articulatory: "#95A8BD",
    prosodic: "#B7A07F",
    respiratory: "#A4ACA6",
    linguistic: "#C68C8C",
  };
  return (
    <span
      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
      style={{
        background: (colours[dim] || "#ccc") + "20",
        color: "#1F2622",
        border: `1px solid ${(colours[dim] || "#ccc") + "55"}`,
      }}
      title={`${dim}: ${v == null ? "—" : v}`}
    >
      {DIMENSION_LABEL[dim]} {v == null ? "—" : v}
    </span>
  );
}


function SeverityBadge({ severity, count }) {
  const styles = {
    watch: { bg: "#F4E5C9", fg: "#7A5A1F" },
    review: { bg: "#F4D7D7", fg: "#7A2424" },
  };
  const s = styles[severity] || { bg: "#eee", fg: "#333" };
  return (
    <span
      className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded"
      style={{ background: s.bg, color: s.fg }}
    >
      {severity} {count > 1 ? `× ${count}` : ""}
    </span>
  );
}
