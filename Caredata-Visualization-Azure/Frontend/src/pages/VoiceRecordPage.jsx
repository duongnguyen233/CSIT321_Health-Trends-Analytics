/**
 * VoiceRecordPage — Public resident-facing recording page.
 *
 * Accessed via /voice/record/:token (no Navbar, no Footer).
 * Elderly-accessible: large fonts, high contrast, minimal UI.
 *
 * Flow:
 *   1. Validate link token
 *   2. If no account → registration form (name + 4-char password)
 *   3. If has account → login (password only)
 *   4. Consent screen (first time only)
 *   5. After auth + consent → show recording interface with prompt
 */
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  validateVoiceLink,
  registerResident,
  loginResident,
  uploadRecording,
  getRandomPrompt,
  getConsent,
  updateConsent,
} from "../services/voiceApi";
import RecordingWidget from "../components/voice/RecordingWidget";

export default function VoiceRecordPage() {
  const { token } = useParams();
  const [step, setStep] = useState("loading"); // loading | invalid | register | login | consent | record
  const [linkData, setLinkData] = useState(null);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState(null);

  // Registration / login fields
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Validate link on mount
  useEffect(() => {
    if (!token) {
      setStep("invalid");
      return;
    }
    validateVoiceLink(token)
      .then((data) => {
        setLinkData(data);
        if (!data.valid) {
          setStep("invalid");
        } else if (data.has_account) {
          setStep("login");
        } else {
          setStep("register");
        }
      })
      .catch(() => {
        setStep("invalid");
      });
  }, [token]);

  // Load prompt when entering record step
  useEffect(() => {
    if (step === "record" && !prompt) {
      getRandomPrompt()
        .then(setPrompt)
        .catch(() =>
          setPrompt({
            id: "fallback",
            type: "open_response",
            text: "Please tell me about your day today.",
          })
        );
    }
  }, [step, prompt]);

  // After successful auth, check consent
  const proceedAfterAuth = useCallback(async () => {
    try {
      const { consent_status } = await getConsent();
      if (consent_status === "active") {
        setStep("record");
      } else {
        setStep("consent");
      }
    } catch {
      // If consent check fails, show consent screen to be safe
      setStep("consent");
    }
  }, []);

  const handleRegister = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      if (displayName.trim().length < 1) {
        setError("Please enter your name.");
        return;
      }
      if (password.length < 4) {
        setError("Password must be at least 4 characters.");
        return;
      }
      setSubmitting(true);
      try {
        const result = await registerResident(token, displayName.trim(), password);
        localStorage.setItem("resident_token", result.access_token);
        setStep("consent"); // New registrations always need consent
      } catch (err) {
        const msg = err.response?.data?.detail || "Registration failed. Please try again.";
        setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      } finally {
        setSubmitting(false);
      }
    },
    [token, displayName, password]
  );

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      if (password.length < 4) {
        setError("Please enter your password.");
        return;
      }
      setSubmitting(true);
      try {
        const result = await loginResident(linkData.resident_id, password);
        localStorage.setItem("resident_token", result.access_token);
        await proceedAfterAuth();
      } catch (err) {
        const msg = err.response?.data?.detail || "Login failed. Please check your password.";
        setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      } finally {
        setSubmitting(false);
      }
    },
    [linkData, password, proceedAfterAuth]
  );

  const handleConsent = useCallback(async () => {
    setSubmitting(true);
    try {
      await updateConsent(true);
      setStep("record");
    } catch {
      setError("Failed to save consent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, []);

  const handleUpload = useCallback(async (wavBlob) => {
    const file = new File([wavBlob], "recording.wav", { type: "audio/wav" });
    await uploadRecording(file);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
      {/* Logo / Header */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-gray-900">CareData</h1>
        <p className="text-xl text-gray-500 mt-1">Voice Health Check</p>
      </div>

      {/* Loading */}
      {step === "loading" && (
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xl text-gray-500 mt-4">Loading...</p>
        </div>
      )}

      {/* Invalid link */}
      {step === "invalid" && (
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-3xl font-semibold text-gray-900 mb-4">
            {linkData?.message || "This link is no longer valid."}
          </h2>
          <p className="text-xl text-gray-600">
            Please ask your nurse for a new recording link.
          </p>
        </div>
      )}

      {/* Registration form */}
      {step === "register" && (
        <form onSubmit={handleRegister} className="w-full max-w-md space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-semibold text-gray-900">Welcome</h2>
            <p className="text-xl text-gray-600 mt-2">
              Please create your name and password to get started.
            </p>
          </div>

          <div>
            <label className="block text-xl font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full text-2xl px-5 py-4 border-2 border-gray-300 rounded-xl
                         focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="e.g. Margaret"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xl font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-2xl px-5 py-4 border-2 border-gray-300 rounded-xl
                         focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="At least 4 characters"
            />
          </div>

          {error && <p className="text-lg text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-5 bg-primary text-white text-2xl font-semibold rounded-xl
                       hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating account..." : "Continue"}
          </button>
        </form>
      )}

      {/* Login form */}
      {step === "login" && (
        <form onSubmit={handleLogin} className="w-full max-w-md space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-semibold text-gray-900">
              Welcome back{linkData?.display_name ? `, ${linkData.display_name}` : ""}
            </h2>
            <p className="text-xl text-gray-600 mt-2">
              Please enter your password to continue.
            </p>
          </div>

          <div>
            <label className="block text-xl font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-2xl px-5 py-4 border-2 border-gray-300 rounded-xl
                         focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Enter your password"
              autoFocus
            />
          </div>

          {error && <p className="text-lg text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-5 bg-primary text-white text-2xl font-semibold rounded-xl
                       hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {submitting ? "Logging in..." : "Continue"}
          </button>
        </form>
      )}

      {/* Consent screen */}
      {step === "consent" && (
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center mb-4">
            <h2 className="text-3xl font-semibold text-gray-900">Consent for Voice Recording</h2>
          </div>

          <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 space-y-4 text-lg text-gray-700">
            <p>
              <strong>What is recorded:</strong> A short voice sample (30–60 seconds) of you speaking aloud.
            </p>
            <p>
              <strong>How it is used:</strong> Your recording is analysed by computer to check for changes
              in your speech patterns that may indicate health changes.
            </p>
            <p>
              <strong>Who can see results:</strong> Your nurse and care team can view the analysis results.
              They <strong>cannot</strong> listen to your recording.
            </p>
            <p>
              <strong>Your rights:</strong> You own your recordings. You can listen to, download, or delete
              them at any time. You can withdraw consent at any time.
            </p>
            <p>
              <strong>Storage:</strong> Recordings are stored securely and encrypted. Analysis results are
              kept even if you delete the recording.
            </p>
          </div>

          {error && <p className="text-lg text-red-600">{error}</p>}

          <button
            onClick={handleConsent}
            disabled={submitting}
            className="w-full py-5 bg-primary text-white text-2xl font-semibold rounded-xl
                       hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving..." : "I Agree — Continue"}
          </button>

          <p className="text-center text-gray-400 text-base">
            You can withdraw consent at any time through your recording portal.
          </p>
        </div>
      )}

      {/* Recording interface */}
      {step === "record" && (
        <div className="w-full max-w-lg">
          <RecordingWidget prompt={prompt} onUpload={handleUpload} />
        </div>
      )}

      {/* Footer disclaimer */}
      <p className="mt-12 text-sm text-gray-400 text-center max-w-md">
        This recording is used for health monitoring purposes only.
        You own your recordings and can request deletion at any time.
      </p>
    </div>
  );
}
