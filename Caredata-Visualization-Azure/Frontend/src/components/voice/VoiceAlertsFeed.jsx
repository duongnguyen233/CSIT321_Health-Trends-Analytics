/**
 * VoiceAlertsFeed (v2) — sidebar feed of open alerts ordered newest first.
 *
 * Props:
 *   alerts        Array of dim-alert objects from /api/voice/v2/n/alerts
 *   residents     Array of residents from /api/voice/v2/n/residents
 *                 (used to surface display_name on the row)
 *   onOpen        (resident) => void — called when the resident row is clicked
 *   onAfterAck    () => void — called after an ack succeeds so the parent
 *                 can reload data
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
    <div className="bg-white border border-gray-100 rounded-lg p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-3">
        Open alerts ({alerts.length})
      </h3>
      {alerts.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No open alerts.</p>
      ) : (
        <ul className="space-y-2">
          {alerts.slice(0, 12).map((a) => {
            const resident = residentByProfile[a.profile_id];
            return (
              <li
                key={a.alert_id}
                className="border border-gray-100 rounded-md p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <SeverityChip severity={a.severity} />
                  <span className="text-xs text-gray-700 font-semibold">
                    {DIMENSION_LABELS[a.dimension] || a.dimension}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => resident && onOpen?.(resident)}
                  disabled={!resident}
                  className="text-sm font-semibold text-gray-900 hover:underline disabled:no-underline text-left w-full"
                  title={resident ? "Open resident detail" : a.resident_id}
                >
                  {resident?.display_name || a.resident_id || "—"}
                </button>
                <p className="text-xs text-gray-700 mt-1 leading-snug">
                  {a.summary}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-gray-500">
                    {a.created_at?.slice(0, 16).replace("T", " ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAck(a.alert_id)}
                    disabled={!!acking[a.alert_id]}
                    className="text-[11px] font-semibold underline text-gray-700 hover:text-gray-900 disabled:opacity-50"
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
