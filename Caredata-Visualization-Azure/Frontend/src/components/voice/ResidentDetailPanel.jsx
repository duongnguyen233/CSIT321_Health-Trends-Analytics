/**
 * ResidentDetailPanel — slide-over drawer for a single resident.
 * Styled to match the Caredata design system (cream + paper surfaces,
 * sage/clay tints, cd-btn utilities, Instrument Serif headings).
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


const DIMENSION_COLOURS = {
  phonatory: "var(--sage)",
  articulatory: "#95A8BD",
  prosodic: "var(--clay)",
  respiratory: "#A4ACA6",
  linguistic: "#C68C8C",
};

const DIMENSION_HEX = {
  phonatory: "#8AA791",
  articulatory: "#95A8BD",
  prosodic: "#B7A07F",
  respiratory: "#A4ACA6",
  linguistic: "#C68C8C",
};

const DIMENSION_LABELS = {
  phonatory: "Voice quality",
  articulatory: "Speech clarity",
  prosodic: "Speech rhythm",
  respiratory: "Breath support",
  linguistic: "Language fluency",
};

const DIMENSIONS = ["phonatory", "articulatory", "prosodic", "respiratory", "linguistic"];


export default function ResidentDetailPanel({
  resident,
  onClose,
  onAckedAlert,
  onBaselineLocked,
}) {
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
          const my = (a.alerts || []).filter(
            (x) =>
              x.profile_id === resident.profile_id ||
              x.resident_id === resident.resident_id
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
      style={{ background: "rgba(31, 38, 34, 0.4)" }}
    >
      <button
        type="button"
        onClick={onClose}
        className="flex-1"
        aria-label="Close"
        style={{ background: "transparent" }}
      />
      <aside
        className="w-full max-w-2xl h-full overflow-y-auto"
        style={{
          background: "var(--bg-cream)",
          borderLeft: "1px solid var(--line)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-4 sticky top-0 z-10"
          style={{
            background: "var(--bg-cream)",
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--line-soft)",
          }}
        >
          <div>
            <span className="cd-chip mb-2">
              <span className="dot" />
              Resident · {resident.resident_id}
            </span>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 26,
                letterSpacing: "-0.01em",
                color: "var(--ink-900)",
                lineHeight: 1.15,
                marginTop: 6,
              }}
            >
              {resident.display_name}
            </h2>
            <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 4 }}>
              {baselineLocked
                ? `Baseline locked v${resident.baseline_version} · ${
                    resident.baseline_locked_at?.slice(0, 10) || ""
                  }`
                : "No baseline yet"}
            </div>
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

        <div style={{ padding: "20px 24px" }} className="space-y-6">
          {/* Action row */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleIssueLink}
              disabled={issuingLink}
              className="cd-btn cd-btn-primary"
              style={{ fontSize: 13 }}
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
              className="cd-btn cd-btn-soft"
              style={{
                fontSize: 13,
                opacity: !canLockBaseline ? 0.5 : 1,
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
            <div
              style={{
                background: "var(--bg-sage-tint)",
                border: "1px solid var(--line-soft)",
                borderRadius: "var(--r-md)",
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--sage-ink)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                Today&rsquo;s link
              </div>
              <code
                className="block break-all"
                style={{
                  fontSize: 11,
                  color: "var(--ink-700)",
                  fontFamily: "var(--font-mono)",
                  background: "var(--bg-white)",
                  border: "1px solid var(--line-soft)",
                  borderRadius: 8,
                  padding: "6px 10px",
                }}
              >
                {recentLink.url}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(recentLink.url)}
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--ink-700)",
                  textDecoration: "underline",
                }}
              >
                Copy URL
              </button>
            </div>
          )}

          {statusMsg && (
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-700)",
                background: "var(--bg-paper)",
                border: "1px solid var(--line-soft)",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              {statusMsg}
            </div>
          )}

          {/* Concern score */}
          <Section title="Concern score (last 60 days)">
            {series.length === 0 ? (
              <Empty>No recordings yet.</Empty>
            ) : (
              <div
                style={{
                  background: "var(--bg-white)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-md)",
                  padding: 12,
                  paddingRight: 8,
                }}
              >
                <div style={{ width: "100%", height: 180 }}>
                  <ResponsiveContainer>
                    <LineChart data={series}>
                      <XAxis
                        dataKey="idx"
                        tick={{ fontSize: 10, fill: "var(--ink-500)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: "var(--ink-500)" }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: 11,
                          background: "var(--bg-white)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                        }}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.scored_at?.slice(0, 10) || ""
                        }
                      />
                      <ReferenceLine
                        y={80}
                        stroke="#C68C8C"
                        strokeDasharray="4 4"
                        label={{
                          value: "review",
                          fontSize: 10,
                          fill: "#7A2424",
                          position: "right",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="concern_score"
                        stroke="var(--ink-900)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </Section>

          {/* Sub-scores */}
          <Section title="Dimension sub-scores">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DIMENSIONS.map((dim) => (
                <Sparkline
                  key={dim}
                  label={DIMENSION_LABELS[dim]}
                  dim={dim}
                  series={series}
                  colour={DIMENSION_HEX[dim]}
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
                    style={{
                      background: "var(--bg-white)",
                      border: "1px solid var(--line-soft)",
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <SeverityChip severity={a.severity} />
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--ink-700)",
                              fontWeight: 600,
                            }}
                          >
                            {DIMENSION_LABELS[a.dimension] || a.dimension}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: 13,
                            color: "var(--ink-900)",
                            lineHeight: 1.5,
                          }}
                        >
                          {a.summary}
                        </p>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--ink-500)",
                            marginTop: 4,
                          }}
                        >
                          {a.created_at?.slice(0, 16).replace("T", " ")}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAck(a.alert_id)}
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: "var(--ink-700)",
                          textDecoration: "underline",
                          flexShrink: 0,
                        }}
                      >
                        Acknowledge
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Recordings */}
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
      <h3
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--ink-500)",
          marginBottom: 10,
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}


function Empty({ children }) {
  return (
    <div
      style={{
        fontSize: 13,
        color: "var(--ink-500)",
        fontStyle: "italic",
        background: "var(--bg-white)",
        border: "1px dashed var(--line-soft)",
        borderRadius: 12,
        padding: 14,
      }}
    >
      {children}
    </div>
  );
}


function Sparkline({ label, dim, series, colour }) {
  const last = series[series.length - 1]?.[dim] ?? 0;
  return (
    <div
      style={{
        background: "var(--bg-white)",
        border: "1px solid var(--line-soft)",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--ink-700)",
          }}
        >
          {label}
        </span>
        <span
          className="tabular-nums"
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 6,
            background: colour + "20",
            color: "var(--ink-900)",
            fontFamily: "var(--font-serif)",
          }}
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
    info: { bg: "var(--bg-sage-tint)", fg: "var(--sage-ink)" },
    watch: { bg: "#F4E5C9", fg: "#7A5A1F" },
    review: { bg: "#F4D7D7", fg: "#7A2424" },
  };
  const s = styles[severity] || styles.info;
  return (
    <span
      style={{
        fontSize: 9,
        textTransform: "uppercase",
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        letterSpacing: "0.06em",
      }}
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

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

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
      setErrMsg(
        e?.response?.status === 404 ? "Audio not available." : "Could not load audio."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <li
      style={{
        background: "var(--bg-white)",
        border: "1px solid var(--line-soft)",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div style={{ fontSize: 13, color: "var(--ink-900)", fontWeight: 500 }}>
            {scoredAt?.slice(0, 16).replace("T", " ") || recordingId}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>
            Concern {Math.round(concern)}/100
          </div>
        </div>
        {playUrl ? (
          <audio src={playUrl} controls preload="metadata" className="max-w-xs" />
        ) : (
          <button
            type="button"
            onClick={handleLoad}
            disabled={loading}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--ink-700)",
              textDecoration: "underline",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Loading…" : "Play"}
          </button>
        )}
      </div>
      {errMsg && (
        <div style={{ fontSize: 11, color: "#7A2424", marginTop: 4 }}>{errMsg}</div>
      )}
    </li>
  );
}
