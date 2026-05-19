/**
 * Voice biomarker recording widget — 4-stage daily battery (~75 s).
 *
 * Walks the resident through sustained_a -> ddk -> reading -> open_prompt
 * with a per-stage timer + progress bar. On completion, captures the
 * Blob, the per-stage offsets the audio actually got recorded at, the
 * resident-toggled context flags, and a snapshot of the MediaStream
 * constraints, then submits via uploadRecording().
 *
 * HARD CONTRACT (per VOICE_BIOMARKER.md \xa77.3):
 *   getUserMedia({ audio: {
 *     channelCount: 1,
 *     echoCancellation: true,
 *     noiseSuppression: false,    // MUST be false
 *     autoGainControl: false,     // MUST be false
 *   }})
 *
 * Backend rejects 400 AUDIO_CONSTRAINTS_VIOLATED if these flip.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRecordingStatus, uploadRecording } from "../../services/voiceApiV2";


const AUDIO_CONSTRAINTS = {
  audio: {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: false,
  },
};


function stageColor(idx, total) {
  const palette = ["#8AA791", "#95A8BD", "#B7A07F", "#A4ACA6"];
  return palette[idx % total] || palette[0];
}


export default function RecordingWidget({ token, stages, onComplete, onError }) {
  const [phase, setPhase] = useState("intro"); // intro | recording | uploading | processing | success | failed | error
  const [stageIdx, setStageIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [failReason, setFailReason] = useState(null);
  const [contextFlags, setContextFlags] = useState({
    cold: false,
    dentures_out: false,
    just_woke_up: false,
    pain: false,
  });
  const [errorMsg, setErrorMsg] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const tickRef = useRef(null);
  const startTsRef = useRef(0);
  const stageTimestampsRef = useRef([]);

  const totalTarget = useMemo(
    () => stages.reduce((acc, s) => acc + (s.target_duration_s || 0), 0),
    [stages]
  );

  useEffect(() => () => {
    cleanupStream();
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  function cleanupStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }

  async function start() {
    setErrorMsg(null);
    chunksRef.current = [];
    stageTimestampsRef.current = stages.map((s) => ({ id: s.id, start: null, end: null }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      streamRef.current = stream;
      const mime =
        ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
          window.MediaRecorder?.isTypeSupported?.(t)
        ) || "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleRecorderStop;
      recorder.start(250);
      mediaRecorderRef.current = recorder;

      startTsRef.current = performance.now();
      stageTimestampsRef.current[0].start = 0;
      setStageIdx(0);
      setElapsed(0);
      setPhase("recording");
      tickRef.current = setInterval(tick, 100);
    } catch (e) {
      setErrorMsg(
        e?.name === "NotAllowedError"
          ? "Microphone access was denied. Please allow access and try again."
          : `Could not start recording: ${e?.message || e}`
      );
      setPhase("error");
      onError?.(e);
    }
  }

  function tick() {
    const now = (performance.now() - startTsRef.current) / 1000;
    setElapsed(now);
    const idx = stageIdxFromElapsed(now);
    if (idx !== stageIdx) {
      const ts = stageTimestampsRef.current;
      if (ts[stageIdx]) ts[stageIdx].end = now;
      if (idx < stages.length && ts[idx]) ts[idx].start = now;
      setStageIdx(idx);
      if (idx >= stages.length) finishRecording();
    }
  }

  function stageIdxFromElapsed(t) {
    let acc = 0;
    for (let i = 0; i < stages.length; i++) {
      acc += stages[i].target_duration_s || 0;
      if (t < acc) return i;
    }
    return stages.length;
  }

  function finishRecording() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const ts = stageTimestampsRef.current;
    if (ts[stages.length - 1] && ts[stages.length - 1].end == null) {
      ts[stages.length - 1].end = (performance.now() - startTsRef.current) / 1000;
    }
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }

  async function handleRecorderStop() {
    const tracks = streamRef.current?.getTracks() ?? [];
    const trackSettings = tracks[0]?.getSettings?.() || {};
    cleanupStream();

    if (chunksRef.current.length === 0) {
      setErrorMsg("No audio captured. Please try again.");
      setPhase("error");
      return;
    }

    setPhase("uploading");
    try {
      const blob = new Blob(chunksRef.current, {
        type: chunksRef.current[0].type || "audio/webm",
      });
      const stageOffsets = buildStageOffsetsFromTimestamps();
      const clientMeta = {
        ua: navigator.userAgent || "unknown",
        sample_rate: trackSettings.sampleRate || 48000,
        channels: trackSettings.channelCount || 1,
        echo_cancellation: !!trackSettings.echoCancellation,
        noise_suppression: trackSettings.noiseSuppression === true,
        auto_gain_control: trackSettings.autoGainControl === true,
      };
      const out = await uploadRecording({
        token,
        audio: blob,
        stageOffsets,
        contextFlags,
        clientMeta,
      });
      // The upload returned 202 (queued). Now poll the recording-status
      // endpoint until processing completes — the resident sees the real
      // outcome (done / low-quality / processing-error) instead of a
      // misleading "Thank you" while the BG task crashes silently.
      setPhase("processing");
      const recordingId = out.recording_id;
      let final = null;
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const st = await getRecordingStatus(recordingId, token);
          if (st.status === "done") { final = "done"; break; }
          if (st.status === "failed") {
            final = "failed";
            setFailReason(st.fail_reason || "processing_error");
            break;
          }
        } catch {
          /* keep polling */
        }
      }
      if (final === "done") {
        setPhase("success");
        onComplete?.(out);
      } else if (final === "failed") {
        setPhase("failed");
        onError?.(new Error("recording_failed"));
      } else {
        // Still processing after 50s — let the resident go but tell them
        // their recording is being analysed.
        setPhase("success");
        onComplete?.(out);
      }
    } catch (e) {
      const code = e?.response?.data?.detail?.code;
      const msg =
        code === "AUDIO_CONSTRAINTS_VIOLATED"
          ? "Your browser is preprocessing the audio. Please try a different browser, or check your microphone settings."
          : code === "VALIDATION"
          ? "The recording could not be validated by the server. Please try again."
          : `Upload failed: ${e?.message || "unknown error"}`;
      setErrorMsg(msg);
      setPhase("error");
      onError?.(e);
    }
  }

  function buildStageOffsetsFromTimestamps() {
    const ts = stageTimestampsRef.current;
    const total = (performance.now() - startTsRef.current) / 1000;
    const out = {};
    for (let i = 0; i < stages.length; i++) {
      const s = ts[i];
      const start = s?.start ?? 0;
      const end = s?.end ?? Math.min(total, start + (stages[i].target_duration_s || 0));
      out[stages[i].id] = [Number(start.toFixed(2)), Number(end.toFixed(2))];
    }
    return out;
  }

  if (phase === "intro") {
    return (
      <IntroPanel
        stages={stages}
        contextFlags={contextFlags}
        setContextFlags={setContextFlags}
        onStart={start}
        totalTarget={totalTarget}
      />
    );
  }
  if (phase === "recording") {
    return (
      <RecordingPanel
        stages={stages}
        stageIdx={stageIdx}
        elapsed={elapsed}
        totalTarget={totalTarget}
        onStop={finishRecording}
      />
    );
  }
  if (phase === "uploading") return <UploadingPanel label="Uploading recording…" />;
  if (phase === "processing") return <UploadingPanel label="Analysing your recording…" />;
  if (phase === "success") return <SuccessPanel />;
  if (phase === "failed")
    return (
      <ErrorPanel
        message={
          failReason === "low_audio_quality"
            ? "We couldn't hear you clearly. Please try again somewhere quieter, with the device closer to you."
            : "Something went wrong while analysing your recording. Please try again."
        }
        onRetry={() => {
          setFailReason(null);
          setPhase("intro");
        }}
      />
    );
  return <ErrorPanel message={errorMsg} onRetry={() => setPhase("intro")} />;
}


function IntroPanel({ stages, contextFlags, setContextFlags, onStart, totalTarget }) {
  const flagOptions = [
    { id: "cold", label: "I have a cold today" },
    { id: "dentures_out", label: "My dentures are out" },
    { id: "just_woke_up", label: "I just woke up" },
    { id: "pain", label: "I am in pain right now" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-xl shadow-md p-6 max-w-2xl mx-auto"
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Today&rsquo;s voice check-in
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Four short prompts in about {Math.round(totalTarget)} seconds.
        Find a quiet spot. Speak naturally.
      </p>
      <ol className="space-y-2 mb-5">
        {stages.map((s, i) => (
          <li key={s.id} className="flex gap-3">
            <div
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold"
              style={{ background: "var(--bg-cream)", color: "var(--ink-900)" }}
            >
              {i + 1}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {s.text || s.id}
              </div>
              {s.instruction && (
                <div className="text-xs text-gray-600 mt-0.5">{s.instruction}</div>
              )}
              <div className="text-xs text-gray-500 mt-0.5">
                ~{s.target_duration_s}s
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="border-t border-gray-100 pt-4 mb-5">
        <p className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
          Anything we should know about today?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {flagOptions.map((f) => (
            <label
              key={f.id}
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={!!contextFlags[f.id]}
                onChange={(e) =>
                  setContextFlags({ ...contextFlags, [f.id]: e.target.checked })
                }
                className="accent-primary"
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="bg-primary text-white font-semibold rounded-md px-6 py-3 hover:bg-orange-500 w-full"
      >
        Start recording
      </button>
      <p className="text-xs text-gray-500 mt-3 text-center">
        This is a trend monitoring tool, not a diagnostic device.
      </p>
    </motion.div>
  );
}


function RecordingPanel({ stages, stageIdx, elapsed, totalTarget, onStop }) {
  const cur = stages[Math.min(stageIdx, stages.length - 1)];
  let stageStartElapsed = 0;
  for (let i = 0; i < stageIdx; i++) stageStartElapsed += stages[i].target_duration_s || 0;
  const stagePct =
    cur && cur.target_duration_s > 0
      ? Math.min(100, ((elapsed - stageStartElapsed) / cur.target_duration_s) * 100)
      : 100;
  const overallPct = Math.min(100, (elapsed / totalTarget) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-xl shadow-md p-6 max-w-2xl mx-auto"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <span className="text-sm font-semibold text-gray-900">
          Recording &middot; stage {Math.min(stageIdx + 1, stages.length)} of {stages.length}
        </span>
      </div>

      <div className="mb-4">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${overallPct}%`,
              background: stageColor(stageIdx, stages.length),
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{elapsed.toFixed(1)}s</span>
          <span>~{totalTarget}s total</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={stageIdx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="bg-[#FBF8F2] border border-[#ECE6D9] rounded-lg p-5"
        >
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            Stage {Math.min(stageIdx + 1, stages.length)}
          </div>
          <div className="text-base font-semibold text-gray-900 leading-snug">
            {cur?.text}
          </div>
          {cur?.instruction && (
            <div className="text-sm text-gray-600 mt-2">{cur.instruction}</div>
          )}
          <div className="mt-4 h-1.5 bg-white border border-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${stagePct}%`,
                background: stageColor(stageIdx, stages.length),
              }}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onStop}
          className="text-sm font-semibold text-gray-700 underline hover:text-gray-900"
        >
          Stop early
        </button>
      </div>
    </motion.div>
  );
}


function UploadingPanel({ label = "Uploading recording…" }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-md p-8 max-w-2xl mx-auto text-center">
      <div className="inline-block h-8 w-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin mb-3" />
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <div className="text-xs text-gray-600 mt-1">Almost done.</div>
    </div>
  );
}


function SuccessPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border border-gray-100 rounded-xl shadow-md p-8 max-w-2xl mx-auto text-center"
    >
      <div
        className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: "var(--bg-sage-tint)", color: "var(--sage-ink)" }}
      >
        <svg viewBox="0 0 20 20" width="22" height="22" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.8 6.3-6.3a1 1 0 011.4 0z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-gray-900 mb-1">Thank you.</h2>
      <p className="text-sm text-gray-600">
        Your recording was sent to your nursing team. You can close this page.
      </p>
    </motion.div>
  );
}


function ErrorPanel({ message, onRetry }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-md p-8 max-w-2xl mx-auto text-center">
      <div
        className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: "#FEE3E3", color: "#A33" }}
      >
        <svg viewBox="0 0 20 20" width="22" height="22" fill="currentColor">
          <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 5h2v6H9V5zm0 8h2v2H9v-2z" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-gray-900 mb-1">
        Something went wrong
      </h2>
      <p className="text-sm text-gray-600 mb-4">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-primary text-white font-semibold rounded-md px-5 py-2 hover:bg-orange-500"
      >
        Try again
      </button>
    </div>
  );
}
