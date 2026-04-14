/**
 * RecordingWidget — accessible voice recording component.
 *
 * Uses browser MediaRecorder API to capture audio, converts to WAV via
 * AudioContext for backend compatibility. Large UI elements for elderly users.
 *
 * Props:
 *   prompt     — { id, type, text } prompt object to display
 *   onUpload   — async (wavBlob) => void — called when user confirms upload
 *   disabled   — boolean — disable recording
 */
import { useState, useRef, useCallback, useEffect } from "react";

const MAX_DURATION_S = 60;

export default function RecordingWidget({ prompt, onUpload, disabled = false }) {
  const [state, setState] = useState("idle"); // idle | recording | recorded | uploading | done | error
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      audioChunks.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.onstop = () => {
        clearInterval(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());
        setState("recorded");
      };

      recorder.start();
      setState("recording");
      setElapsed(0);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(secs);
        if (secs >= MAX_DURATION_S) {
          recorder.stop();
        }
      }, 250);
    } catch (err) {
      setErrorMsg(
        "Could not access your microphone. Please allow microphone access and try again."
      );
      setState("error");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
    }
  }, []);

  const handleUpload = useCallback(async () => {
    setState("uploading");
    try {
      const blob = new Blob(audioChunks.current, { type: "audio/webm" });
      // Convert WebM → WAV via AudioContext
      const wavBlob = await convertToWav(blob);
      await onUpload(wavBlob);
      setState("done");
    } catch (err) {
      setErrorMsg("Upload failed. Please try again.");
      setState("error");
    }
  }, [onUpload]);

  const handleReRecord = useCallback(() => {
    audioChunks.current = [];
    setState("idle");
    setElapsed(0);
    setErrorMsg("");
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-lg mx-auto">
      {/* Prompt display */}
      {prompt && state !== "done" && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 w-full">
          <p className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">
            {prompt.type === "read_aloud"
              ? "Please read aloud"
              : prompt.type === "sequencing"
              ? "Follow the instruction"
              : "Tell us about..."}
          </p>
          <p className="text-2xl leading-relaxed text-gray-900 font-medium">
            {prompt.text}
          </p>
        </div>
      )}

      {/* Timer */}
      {(state === "recording" || state === "recorded") && (
        <div className="text-center">
          <span className="text-6xl font-bold text-gray-900 tabular-nums">
            {formatTime(elapsed)}
          </span>
          <p className="text-lg text-gray-500 mt-2">
            {state === "recording"
              ? `Recording... (max ${MAX_DURATION_S}s)`
              : "Recording complete"}
          </p>
        </div>
      )}

      {/* Recording indicator */}
      {state === "recording" && (
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xl text-red-600 font-semibold">Recording</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col items-center gap-4 w-full">
        {state === "idle" && (
          <button
            onClick={startRecording}
            disabled={disabled}
            className="w-full py-6 bg-primary text-white text-3xl font-semibold rounded-2xl
                       hover:bg-primary-hover active:bg-primary-hover transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            Start Recording
          </button>
        )}

        {state === "recording" && (
          <button
            onClick={stopRecording}
            className="w-full py-6 bg-red-600 text-white text-3xl font-semibold rounded-2xl
                       hover:bg-red-700 active:bg-red-800 transition-colors shadow-lg"
          >
            Stop Recording
          </button>
        )}

        {state === "recorded" && (
          <div className="flex gap-4 w-full">
            <button
              onClick={handleReRecord}
              className="flex-1 py-5 bg-gray-200 text-gray-800 text-2xl font-semibold rounded-2xl
                         hover:bg-gray-300 transition-colors"
            >
              Re-record
            </button>
            <button
              onClick={handleUpload}
              className="flex-1 py-5 bg-primary text-white text-2xl font-semibold rounded-2xl
                         hover:bg-primary-hover transition-colors shadow-lg"
            >
              Upload
            </button>
          </div>
        )}

        {state === "uploading" && (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-2xl text-gray-600 mt-4">Uploading...</p>
          </div>
        )}

        {state === "done" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-3xl font-semibold text-green-700">Thank you!</p>
            <p className="text-xl text-gray-600 mt-2">Your recording has been submitted.</p>
            <button
              onClick={handleReRecord}
              className="mt-6 px-8 py-3 bg-gray-200 text-gray-700 text-xl rounded-xl hover:bg-gray-300 transition-colors"
            >
              Record another
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="text-center py-6">
            <p className="text-xl text-red-600 mb-4">{errorMsg}</p>
            <button
              onClick={handleReRecord}
              className="px-8 py-3 bg-primary text-white text-xl rounded-xl hover:bg-primary-hover transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Convert a WebM audio Blob to WAV format using AudioContext.
 */
async function convertToWav(webmBlob) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Downsample to 16kHz mono for smaller files and backend compatibility
    const targetRate = 16000;
    const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * targetRate, targetRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();

    // Encode as 16-bit PCM WAV
    const pcm = rendered.getChannelData(0);
    const wavBuffer = encodeWav(pcm, targetRate);
    return new Blob([wavBuffer], { type: "audio/wav" });
  } finally {
    audioCtx.close();
  }
}

function encodeWav(samples, sampleRate) {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, numSamples * 2, true);

  // PCM samples (clamped to int16)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
