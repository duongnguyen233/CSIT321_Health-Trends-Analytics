/**
 * VoiceAlertsFeed (v2) — sidebar feed of open alerts ordered newest first.
 * Styled to match the rest of the Caredata UI (cd-surface, sage/clay/ink
 * tints, Geist + Instrument Serif typography).
 */
import { useMemo, useState } from "react";

import { ackAlert } from "../../services/voiceApiV2";


const DIMENSION_LABELS = {
  phonatory: "Voice quality",
  articulatory: "Speech clarity",
  prosodic: "Speech rhythm",
  respiratory: "Breath support",
  linguistic: "Language fluency",
};


export default function VoiceAlertsFeed({ alerts = [], residents = [], onOpen, onAfterAck }) {
  const [acking, setAcking] = useState({});

  const residentByProfile = useMemo(() => {
    const map = {};
    for (const r of residents) {
      if (r.profile_id) map[r.profile_id] = r;
    }
    return map;
  }, [residents]);

  async function handleAck(id) {
    setAcking((prev) => ({ ...prev, [id]: true }));
    try {
      await ackAlert(id);
      onAfterAck?.();
    } finally {
      setAcking((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div
      style={{
        background: "var(--bg-white)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: 16,
      }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h3
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--ink-500)",
          }}
        >
          Open alerts
        </h3>
        <span
          className="tabular-nums"
          style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-700)" }}
        >
          {alerts.length}
        </span>
      </div>

      {alerts.length === 0 ? (
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-500)",
            fontStyle: "italic",
          }}
        >
          No open alerts.
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.slice(0, 12).map((a) => {
            const resident = residentByProfile[a.profile_id];
            return (
              <li
                key={a.alert_id}
                style={{
                  border: "1px solid var(--line-soft)",
                  borderRadius: 12,
                  padding: 12,
                  background: "var(--bg-paper)",
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
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
                <button
                  type="button"
                  onClick={() => resident && onOpen?.(resident)}
                  disabled={!resident}
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink-900)",
                    textAlign: "left",
                    width: "100%",
                    background: "transparent",
                  }}
                  title={resident ? "Open resident detail" : a.resident_id}
                >
                  {resident?.display_name || a.resident_id || "—"}
                </button>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--ink-700)",
                    marginTop: 4,
                    lineHeight: 1.45,
                  }}
                >
                  {a.summary}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span style={{ fontSize: 10, color: "var(--ink-500)" }}>
                    {a.created_at?.slice(0, 16).replace("T", " ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAck(a.alert_id)}
                    disabled={!!acking[a.alert_id]}
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--ink-700)",
                      textDecoration: "underline",
                      background: "transparent",
                      opacity: acking[a.alert_id] ? 0.5 : 1,
                    }}
                  >
                    {acking[a.alert_id] ? "Acking…" : "Acknowledge"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
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
