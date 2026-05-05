/**
 * VoiceRecordPage — public resident-facing recording page (v2).
 *
 * Routed at /voice/record/:token (no nav, no footer). The token IS the
 * auth — we GET /api/voice/v2/r/{token} to fetch the script, then drop
 * the resident straight into the RecordingWidget. No registration / login
 * step in v2 (the previous flow stored a per-resident password; the new
 * spec uses per-day token-only auth).
 *
 * Flow:
 *   loading -> ready  (RecordingWidget renders)
 *           -> expired (link used or expired -> friendly message)
 *           -> error  (network / server error)
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";

import { getLinkMeta } from "../services/voiceApiV2";
import RecordingWidget from "../components/voice/RecordingWidget";
import BrandMark from "../components/common/BrandMark";


export default function VoiceRecordPage() {
  const { token } = useParams();
  const [phase, setPhase] = useState("loading"); // loading | ready | expired | error
  const [link, setLink] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const meta = await getLinkMeta(token);
        if (cancelled) return;
        setLink(meta);
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        const status = e?.response?.status;
        if (status === 410) {
          setPhase("expired");
        } else if (status === 404) {
          setPhase("expired");
        } else {
          setErrorMsg(e?.message || "Could not load this link.");
          setPhase("error");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-paper)" }}
    >
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-2">
          <BrandMark size={28} />
          <span className="text-[15px] font-semibold tracking-tight text-gray-900">
            CareData &middot; Voice check-in
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {phase === "loading" && <LoadingState />}
        {phase === "expired" && <ExpiredState />}
        {phase === "error" && <ErrorState message={errorMsg} />}
        {phase === "ready" && link && (
          <Ready link={link} token={token} />
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-6 py-8 text-xs text-gray-500 text-center">
        This is a trend monitoring tool, not a diagnostic device. Recordings
        are reviewed by your nursing team.
      </footer>
    </div>
  );
}


function Ready({ link, token }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-center mb-6">
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
          {link.valid_for_date}
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
          Hello, {link.resident_display_name}
        </h1>
        <p className="text-sm text-gray-600 mt-2">
          Your nurse asked us to check in with you today. It only takes a minute.
        </p>
      </div>
      <RecordingWidget token={token} stages={link.stages} />
    </motion.div>
  );
}


function LoadingState() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-md p-8 text-center">
      <div className="inline-block h-8 w-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin mb-3" />
      <p className="text-sm text-gray-600">Loading your check-in&hellip;</p>
    </div>
  );
}


function ExpiredState() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-md p-8 text-center">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        This link has expired
      </h2>
      <p className="text-sm text-gray-600">
        Your daily voice link is only good for one recording. Please ask your
        nurse for a fresh link.
      </p>
    </div>
  );
}


function ErrorState({ message }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-md p-8 text-center">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        We couldn&rsquo;t load this page
      </h2>
      <p className="text-sm text-gray-600">{message || "Please try again later."}</p>
    </div>
  );
}
