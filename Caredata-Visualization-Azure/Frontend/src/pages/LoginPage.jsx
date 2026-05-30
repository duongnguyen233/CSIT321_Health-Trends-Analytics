// src/pages/LoginPage.jsx
import { useState } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import BrandMark from "../components/common/BrandMark";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { API_BASE_URL, loginUser, getCurrentUser, resendVerification } from "../services/api";

async function setUserFromApi(token) {
  const userData = await getCurrentUser(token);
  localStorage.setItem("user", JSON.stringify(userData));
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const passwordResetSuccess = location.state?.passwordReset;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const data = await loginUser({ email, password });
      localStorage.setItem("token", data.access_token);
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      } else {
        await setUserFromApi(data.access_token);
      }
      if (remember) localStorage.setItem("rememberEmail", email);
      else localStorage.removeItem("rememberEmail");
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Login error:", err);
      const status = err.response?.status;
      const detail = err.response?.data?.detail || err.message || "Login failed";
      if (status === 403 && typeof detail === "string" && detail.toLowerCase().includes("not verified")) {
        setUnverified(true);
        setError(detail);
      } else {
        setUnverified(false);
        setError(typeof detail === "string" ? detail : "Invalid email or password");
      }
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      if (!res.ok) throw new Error("Google login failed");
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user || {}));
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Google Login Error:", err);
      setError("Google login failed. Please try again.");
    }
  };

  const handleGoogleError = () => {
    setError("Google authentication failed");
  };

  const inputStyle = {
    background: "var(--bg-paper)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    color: "var(--ink-900)",
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar />

      <main className="flex flex-grow items-stretch justify-center px-4 py-12 mt-16 min-h-[calc(100vh-3.1rem)]">
        <div
          className="flex flex-col md:flex-row w-full max-w-6xl overflow-hidden"
          style={{
            background: "var(--bg-white)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {/* Left Panel */}
          <div
            className="hidden md:flex relative flex-col justify-between w-1/2 p-10"
            style={{
              background:
                "linear-gradient(160deg, var(--bg-sage-tint) 0%, var(--bg-cream) 55%, var(--bg-clay-tint) 100%)",
            }}
          >
            <span className="cd-chip" style={{ width: "fit-content" }}>
              <span className="dot" /> Clinical governance
            </span>

            <div className="max-w-sm">
              <h1
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 40,
                  lineHeight: 1.1,
                  color: "var(--ink-900)",
                  letterSpacing: "-0.01em",
                  marginBottom: 12,
                }}
              >
                Quality indicator data, in one calm place.
              </h1>
              <p style={{ color: "var(--ink-500)", fontSize: 14, lineHeight: 1.5 }}>
                Dashboards, benchmarking, voice biomarkers and audit-ready reports —
                aligned to the AIHW Quality Indicator Program Manual 4.0.
              </p>
            </div>

            <div
              className="grid grid-cols-2 gap-3"
              style={{ marginTop: 24 }}
            >
              {[
                { n: "14", l: "QI categories" },
                { n: "44+", l: "indicators" },
                { n: "Quarterly", l: "submissions" },
                { n: "FHIR", l: "aligned" },
              ].map((s) => (
                <div
                  key={s.l}
                  style={{
                    background: "var(--bg-white)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--r-md)",
                    padding: "10px 14px",
                  }}
                >
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink-900)", lineHeight: 1 }}>
                    {s.n}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex flex-col justify-center items-center w-full md:w-1/2 px-8 py-12">
            <div className="w-full max-w-sm">
              {/* Logo */}
              <div className="flex items-center justify-center gap-2.5 mb-6">
                <BrandMark size={26} />
                <span style={{ fontSize: 18, fontWeight: 600, color: "var(--ink-900)" }}>CareData</span>
              </div>

              {/* Tabs */}
              <div className="flex mb-6" style={{ borderBottom: "1px solid var(--line)" }}>
                <button
                  type="button"
                  className="flex-1 py-2.5 text-sm font-medium"
                  style={{
                    color: "var(--ink-900)",
                    borderBottom: "2px solid var(--ink-900)",
                    marginBottom: -1,
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className="flex-1 py-2.5 text-sm font-medium"
                  style={{ color: "var(--ink-500)" }}
                  onClick={() => navigate("/register")}
                >
                  Sign Up
                </button>
              </div>

              {passwordResetSuccess && (
                <div
                  className="text-center p-3 mb-4"
                  style={{
                    background: "var(--bg-sage-tint)",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                  }}
                >
                  <p className="text-sm" style={{ color: "var(--sage-ink)" }}>
                    Password updated. You can sign in with your new password.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 focus:outline-none"
                    style={inputStyle}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2.5 focus:outline-none"
                    style={inputStyle}
                    placeholder="Enter password"
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2" style={{ color: "var(--ink-700)" }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    Remember me
                  </label>
                  <Link
                    to="/forgot-password"
                    className="hover:underline"
                    style={{ color: "var(--sage-ink)", fontWeight: 500 }}
                  >
                    Forgot password?
                  </Link>
                </div>

                {error && (
                  <div
                    className="text-center p-3"
                    style={{
                      background: "var(--bg-clay-tint)",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                    }}
                  >
                    <p className="text-sm" style={{ color: "var(--clay-ink)" }}>{error}</p>
                    {unverified && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await resendVerification(email);
                            alert("Verification email resent! Check your inbox.");
                          } catch {
                            alert("Failed to resend.");
                          }
                        }}
                        className="text-sm font-medium hover:underline mt-1"
                        style={{ color: "var(--sage-ink)" }}
                      >
                        Resend verification email
                      </button>
                    )}
                  </div>
                )}

                <button type="submit" className="cd-btn cd-btn-primary w-full justify-center">
                  Sign In
                </button>
              </form>

              <div className="flex items-center my-6">
                <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
                <span className="px-3 text-xs uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>or</span>
                <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
              </div>

              <div className="flex justify-center w-full">
                {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    width={280}
                    useOneTap={false}
                  />
                ) : (
                  <p className="text-sm text-center py-2" style={{ color: "var(--ink-500)" }}>
                    Set VITE_GOOGLE_CLIENT_ID in Frontend/.env to enable Google sign-in.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
