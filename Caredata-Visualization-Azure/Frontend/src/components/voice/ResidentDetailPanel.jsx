/**
 * ResidentDetailPanel — slide-over drawer for a single resident.
 *
 * Renders:
 *  - concern_score line chart (Recharts) over the last `days` window
 *  - 5 small sub-score sparklines, one per dimension, dimension-coloured
 *  - recent recordings list with audio playback (presigned URL or
 *    Blob-URL streaming fallback)
 *  - alerts list with ack button
 *  - Lock-baseline button (disabled until 10+ feature rows exist —
 *    we proxy this off recordings count for the dashboard, the backend
 *    enforces the real check)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import {
  ackAlert,
  fetchAudioBlobUrl,
  getAudioUrl,
  getScores,
  issueLink,
  listAlerts,
  lockBaseline,
  buildRecordLinkUrl,
} from "../../services/voiceApiV2";


// Dimension colours pulled from chartTokens palette so we don't introduce
// new colour-tokens here. Mapping is stable across charts.
const DIMENSION_COLOURS = {
  phonatory: "#8AA791",     // sage-ink — vocal quality
  articulatory: "#95A8BD",  // dusty-blue — speech clarity
  prosodic: "#B7A07F",      // clay — speech rhythm
  respiratory: "#A4ACA6",   // ink — breath support
  linguistic: "#C68C8C",    // muted rose — language fluency
};

const DIMENSION_LABELS = {
  phonatory: "Voice quality",
  articulatory: "Speech clarity",
  prosodic: "Speech rhythm",
  respiratory: "Breath support",
  linguistic: "Language fluency",
};

const DIMENSIONS = ["phonatory", "articulatory", "prosodic", "respiratory", "linguistic"];


export default function ResidentDetailPanel({ resident, onClose, onAckedAlert, onBaselineLocked }) {
  const [scoresPayload, setScoresPayload] = useState({ scores: [] });
  const [alertsPayload, setAlertsPayload] = useState({ alerts: [] });
  const [issuingLink, setIssuingLink] = useState(false);
  const [lockingBaseline, setLockingBaseline] = useState(false);
  const [recentLink, setRecentLink] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [s, a] = await Promise.all([
          getScores(resident.resident_id, 60),
          listAlerts({ status: "open", limit: 50, cursor: 0 }),
        ]);
        if (!cancelled) {
          setScoresPayload(s);
          // Filter to this resident only
          const my = (a.alerts || []).filter(
            (x) => x.profile_id === resident.profile_id || x.resident_id === resident.resident_id
          );
          setAlertsPayload({ alerts: my });
        }
      } catch (e) {
        if (!cancelled) setStatusMsg(`Failed to load resident: ${e?.message || e}`);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [resident.resident_id, resident.profile_id]);

  // Sort scores by scored_at ascending for charts
  const series = useMemo(() => {
    const arr = (scoresPayload.scores || []).slice();
    arr.sort((a, b) => (a.scored_at || "").localeCompare(b.scored_at || ""));
    return arr.map((s, i) => ({
      idx: i,
      scored_at: s.scored_at,
      concern_score: Number(s.concern_score) || 0,
      ...DIMENSIONS.reduce(
        (acc, d) => ({ ...acc, [d]: Number((s.subscores || {})[d]) || 0 }),
        {}
      ),
      recording_id: s.recording_id,
    }));
  }, [scoresPayload]);

  const recordingCount = series.length;
  const baselineLocked = !!resident.baseline_locked_at;
  const canLockBaseline = !baselineLocked && recordingCount >= 10;

  async function handleIssueLink() {
    setIssuingLink(true);
    setStatusMsg(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const out = await issueLink(resident.resident_id, today);
      setRecentLink({ token: out.token, url: buildRecordLinkUrl(out.token) });
    } catch (e) {
      setStatusMsg(`Could not issue link: ${e?.message || e}`);
    } finally {
      setIssuingLink(false);
    }
  }

  async function handleLockBaseline() {
    setLockingBaseline(true);
    setStatusMsg(null);
    try {
      const out = await lockBaseline(resident.resident_id);
      setStatusMsg(`Baseline locked (version ${out.version}).`);
      onBaselineLocked?.();
    } catch (e) {
      const code = e?.response?.data?.detail?.code;
      if (code === "INSUFFICIENT_RECORDINGS") {
        const have = e.response.data.detail.have;
        const need = e.response.data.detail.need;
        setStatusMsg(`Need ${need} feature-extracted recordings; have ${have}.`);
      } else {
        setStatusMsg(`Lock failed: ${e?.message || e}`);
      }
    } finally {
      setLockingBaseline(false);
    }
  }

  async function handleAck(alertId) {
    try {
      await ackAlert(alertId);
      setAlertsPayload({
        alerts: alertsPayload.alerts.filter((x) => x.alert_id !== alertId),
      });
      onAckedAlert?.();
    } catch (e) {
      setStatusMsg(`Ack failed: ${e?.message || e}`);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-label="Resident detail"
    >
      {/* backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="flex-1 bg-black/30"
        aria-label="Close"
      />
      {/* drawer */}
      <aside
        className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-xl"
        style={{ borderLeft: "1px solid var(--line)" }}
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {resident.display_name}
            </h2>
            <div className="text-xs text-gray-500 mt-0.5">
              ID: {resident.resident_id}
              {baselineLocked
                ? ` · Baseline v${resident.baseline_version}`
                : " · No baseline yet"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 text-xl leading-none px-2"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Action row */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleIssueLink}
              disabled={issuingLink}
              className="bg-primary text-white text-sm font-semibold rounded-md px-4 py-2 hover:bg-orange-500 disabled:opacity-50"
            >
              {issuingLink ? "Issuing…" : "Issue today's link"}
            </button>
            <button
              type="button"
              onClick={handleLockBaseline}
              disabled={!canLockBaseline || lockingBaseline}
              title={
                baselineLocked
                  ? "Baseline already locked"
                  : `Requires 10+ scored recordings (currently ${recordingCount})`
              }
              className="text-sm font-semibold rounded-md px-4 py-2 disabled:opacity-50"
              style={{
                background: "var(--bg-cream)",
                color: "var(--ink-900)",
                border: "1px solid var(--line)",
              }}
            >
              {lockingBaseline
                ? "Locking…"
                : baselineLocked
                ? "Baseline locked"
                : "Lock baseline"}
            </button>
          </div>

          {recentLink && (
            <div className="bg-[#FBF8F2] border border-[#ECE6D9] rounded-lg p-3 text-sm">
              <div className="font-semibold text-gray-900 mb-1">Today&rsquo;s link</div>
              <code className="block break-all text-xs text-gray-700">
                {recentLink.url}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(recentLink.url)}
                className="mt-2 text-xs font-semibold underline text-gray-700 hover:text-gray-900"
              >
                Copy URL
              </button>
            </div>
          )}

          {statusMsg && (
            <div className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-md p-3">
              {statusMsg}
            </div>
          )}

          {/* Concern score line */}
          <Section title="Concern score (last 60 days)">
            {series.length === 0 ? (
              <Empty>No recordings yet.</Empty>
            ) : (
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                  <LineChart data={series}>
                    <XAxis
                      dataKey="idx"
                      tick={{ fontSize: 10, fill: "#6B7570" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "#6B7570" }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 11 }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.scored_at?.slice(0, 10) || ""}
                    />
                    <ReferenceLine y={80} stroke="#C68C8C" strokeDasharray="4 4" />
                    <Line
                      type="monotone"
                      dataKey="concern_score"
                      stroke="#ff7b00"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          {/* Sub-score sparklines */}
          <Section title="Dimension sub-scores">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DIMENSIONS.map((dim) => (
                <Sparkline
                  key={dim}
                  label={DIMENSION_LABELS[dim]}
                  dim={dim}
                  series={series}
                  colour={DIMENSION_COLOURS[dim]}
                />
              ))}
            </div>
          </Section>

          {/* Alerts */}
          <Section title={`Open alerts (${alertsPayload.alerts.length})`}>
            {alertsPayload.alerts.length === 0 ? (
              <Empty>No open alerts.</Empty>
            ) : (
              <ul className="space-y-2">
                {alertsPayload.alerts.map((a) => (
                  <li
                    key={a.alert_id}
                    className="border border-gray-100 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <SeverityChip severity={a.severity} />
                          <span className="text-xs font-semibold text-gray-700">
                            {DIMENSION_LABELS[a.dimension] || a.dimension}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">{a.summary}</p>
                        <div className="text-xs text-gray-500 mt-1">
                          {a.created_at?.slice(0, 16).replace("T", " ")}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAck(a.alert_id)}
                        className="text-xs font-semibold text-gray-700 underline hover:text-gray-900 shrink-0"
                      >
                        Acknowledge
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Recent recordings with playback */}
          <Section title="Recent recordings">
            {series.length === 0 ? (
              <Empty>No recordings yet.</Empty>
            ) : (
              <ul className="space-y-2">
                {series
                  .slice()
                  .reverse()
                  .slice(0, 5)
                  .map((s) => (
                    <RecordingRow
                      key={s.recording_id}
                      residentId={resident.resident_id}
                      recordingId={s.recording_id}
                      scoredAt={s.scored_at}
                      concern={s.concern_score}
                    />
                  ))}
              </ul>
            )}
          </Section>
        </div>
      </aside>
    </div>
  );
}


function Section({ title, children }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}


function Empty({ children }) {
  return <div className="text-sm text-gray-500 italic">{children}</div>;
}


function Sparkline({ label, dim, series, colour }) {
  const last = series[series.length - 1]?.[dim] ?? 0;
  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span
          className="text-xs font-mono px-1.5 py-0.5 rounded"
          style={{ background: colour + "33", color: "#1F2622" }}
        >
          {Math.round(last)}
        </span>
      </div>
      <div style={{ width: "100%", height: 50 }}>
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <YAxis hide domain={[0, 100]} />
            <Line
              type="monotone"
              dataKey={dim}
              stroke={colour}
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


function SeverityChip({ severity }) {
  const styles = {
    info:   { bg: "#E7F1EA", fg: "#3D5746" },
    watch:  { bg: "#F4E5C9", fg: "#7A5A1F" },
    review: { bg: "#F4D7D7", fg: "#7A2424" },
  };
  const s = styles[severity] || styles.info;
  return (
    <span
      className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded"
      style={{ background: s.bg, color: s.fg }}
    >
      {severity}
    </span>
  );
}


function RecordingRow({ residentId, recordingId, scoredAt, concern }) {
  const [playUrl, setPlayUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState(null);
  const objectUrlRef = useRef(null);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  async function handleLoad() {
    setLoading(true);
    setErrMsg(null);
    try {
      const meta = await getAudioUrl(residentId, recordingId);
      if (meta.kind === "presigned") {
        setPlayUrl(meta.url);
      } else {
        const blobUrl = await fetchAudioBlobUrl(residentId, recordingId);
        objectUrlRef.current = blobUrl;
        setPlayUrl(blobUrl);
      }
    } catch (e) {
      setErrMsg(e?.response?.status === 404 ? "Audio not available." : "Could not load audio.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="border border-gray-100 rounded-lg p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-gray-900 font-medium">
            {scoredAt?.slice(0, 16).replace("T", " ") || recordingId}
          </div>
          <div className="text-xs text-gray-500">
            Concern: {Math.round(concern)}/100
          </div>
        </div>
        {playUrl ? (
          <audio src={playUrl} controls preload="metadata" className="max-w-xs" />
        ) : (
          <button
            type="button"
            onClick={handleLoad}
            disabled={loading}
            className="text-xs font-semibold text-gray-700 underline hover:text-gray-900"
          >
            {loading ? "Loading…" : "Play"}
          </button>
        )}
      </div>
      {errMsg && <div className="text-xs text-red-600 mt-1">{errMsg}</div>}
    </li>
  );
}
