/**
 * Voice Biomarker v2 API client.
 *
 * Wraps every endpoint at /api/voice/v2/*. Nurse endpoints use the shared
 * `api` axios instance (which injects the nurse JWT from localStorage).
 * The public link-metadata + upload endpoints are token-authenticated
 * (the per-day token IS the auth) so they bypass the JWT interceptor.
 */
import axios from "axios";
import { api, API_BASE_URL } from "./api";


// ---------------------------------------------------------------------------
// Public — resident link metadata + upload
// ---------------------------------------------------------------------------


export async function getLinkMeta(token) {
  // Public route — no auth header. 410 = used or expired.
  const res = await axios.get(`${API_BASE_URL}/api/voice/v2/r/${token}`);
  return res.data;
}


/**
 * Upload a recording. The upload contract requires four required form fields
 * alongside the audio blob:
 *
 *   - token         : string
 *   - audio         : File/Blob
 *   - stage_offsets : { sustained_a:[s,e], ddk:[s,e], reading:[s,e], open_prompt:[s,e] }
 *   - context_flags : { cold, dentures_out, just_woke_up, pain }
 *   - client_meta   : { ua, sample_rate, channels, echo_cancellation,
 *                       noise_suppression, auto_gain_control }
 *
 * Returns { recording_id, status }.
 *
 * The backend rejects with 400 AUDIO_CONSTRAINTS_VIOLATED if
 * noise_suppression !== false or auto_gain_control !== false.
 */
export async function uploadRecording({
  token,
  audio,
  stageOffsets,
  contextFlags,
  clientMeta,
}) {
  const fd = new FormData();
  fd.append("token", token);
  fd.append("audio", audio, "recording.webm");
  fd.append("stage_offsets", JSON.stringify(stageOffsets));
  fd.append("context_flags", JSON.stringify(contextFlags));
  fd.append("client_meta", JSON.stringify(clientMeta));

  const res = await axios.post(`${API_BASE_URL}/api/voice/v2/upload`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}


// ---------------------------------------------------------------------------
// Nurse — link issuing
// ---------------------------------------------------------------------------


export async function issueLink(residentId, dateIso) {
  const res = await api.post(
    `/api/voice/v2/n/residents/${encodeURIComponent(residentId)}/issue-link`,
    null,
    { params: { date: dateIso } }
  );
  return res.data; // { token, url, resident_id, valid_for_date, expires_at }
}


// ---------------------------------------------------------------------------
// Nurse — baselines + scores + residents
// ---------------------------------------------------------------------------


export async function lockBaseline(residentId) {
  const res = await api.post(
    `/api/voice/v2/n/residents/${encodeURIComponent(residentId)}/lock-baseline`
  );
  return res.data;
}


export async function listResidents() {
  const res = await api.get("/api/voice/v2/n/residents");
  return res.data; // { residents: [...] }
}


/**
 * Create a voice profile for a new resident. Idempotent — calling with an
 * existing resident_id returns the existing profile with 200 instead of 201.
 */
export async function createResident({ resident_id, display_name, facility_id = "default" }) {
  const res = await api.post("/api/voice/v2/n/residents", {
    resident_id,
    display_name,
    facility_id,
  });
  return res.data; // profile dict
}


export async function getScores(residentId, days = 60) {
  const res = await api.get(
    `/api/voice/v2/n/residents/${encodeURIComponent(residentId)}/scores`,
    { params: { days } }
  );
  return res.data; // { resident_id, days, scores: [...] }
}


// ---------------------------------------------------------------------------
// Nurse — alerts
// ---------------------------------------------------------------------------


export async function listAlerts({ status = "open", limit = 50, cursor = 0 } = {}) {
  const res = await api.get("/api/voice/v2/n/alerts", {
    params: { status, limit, cursor },
  });
  return res.data; // { status, alerts, next_cursor, total }
}


export async function ackAlert(alertId) {
  const res = await api.post(
    `/api/voice/v2/n/alerts/${encodeURIComponent(alertId)}/ack`
  );
  return res.data;
}


// ---------------------------------------------------------------------------
// Nurse — recording audio playback
// ---------------------------------------------------------------------------


/**
 * Returns either a presigned SAS URL ({kind:"presigned"}) or a streaming
 * endpoint relative path ({kind:"stream"}). The caller passes the URL
 * directly to an <audio src=...> tag; the backend stream endpoint requires
 * the nurse JWT, which the api instance injects automatically when the
 * stream URL goes through axios — but a plain <audio> tag in the browser
 * cannot send the Authorization header. For the in-memory dev path, the
 * caller should fetch the bytes via this helper instead and use a Blob
 * URL.
 */
export async function getAudioUrl(residentId, recordingId) {
  const res = await api.get(
    `/api/voice/v2/n/residents/${encodeURIComponent(residentId)}` +
      `/recordings/${encodeURIComponent(recordingId)}/audio`
  );
  return res.data; // { url, kind, expires_in_s }
}


/**
 * Fetch raw audio bytes via the authenticated stream endpoint and return a
 * Blob URL suitable for <audio src=...>. Use when getAudioUrl returned
 * kind="stream" (in-memory blob fallback).
 */
export async function fetchAudioBlobUrl(residentId, recordingId) {
  const res = await api.get(
    `/api/voice/v2/n/residents/${encodeURIComponent(residentId)}` +
      `/recordings/${encodeURIComponent(recordingId)}/stream`,
    { responseType: "blob" }
  );
  return URL.createObjectURL(res.data);
}


// ---------------------------------------------------------------------------
// Recording status (public endpoint — for the resident's "Thank you" poll)
// ---------------------------------------------------------------------------


export async function getRecordingStatus(recordingId, token) {
  const res = await axios.get(
    `${API_BASE_URL}/api/voice/v2/recordings/${encodeURIComponent(recordingId)}/status`,
    { params: { token } }
  );
  return res.data;
}


// ---------------------------------------------------------------------------
// Convenience: build a recording link URL the nurse can copy/paste
// ---------------------------------------------------------------------------


export function buildRecordLinkUrl(token) {
  // The frontend serves the resident page at /voice/record/:token regardless
  // of host. Use the current origin so localhost vs prod both work.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/voice/record/${token}`;
}
