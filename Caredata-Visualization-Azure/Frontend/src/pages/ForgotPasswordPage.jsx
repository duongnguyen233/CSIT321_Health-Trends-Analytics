import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import BrandMark from "../components/common/BrandMark";
import { requestPasswordReset } from "../services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputStyle = {
    background: "var(--bg-paper)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    color: "var(--ink-900)",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Request failed.";
      setError(typeof detail === "string" ? detail : "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar />
      <main className="flex flex-grow items-center justify-center px-4 py-12 mt-16">
        <div
          className="w-full max-w-md p-8"
          style={{
            background: "var(--bg-white)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <BrandMark size={26} />
            <span style={{ fontSize: 18, fontWeight: 600, color: "var(--ink-900)" }}>CareData</span>
          </div>

          <h1
            className="text-center mb-2"
            style={{ fontFamily: "var(--font-serif)", fontSize: 26, color: "var(--ink-900)" }}
          >
            Reset your password
          </h1>
          <p className="text-center text-sm mb-6" style={{ color: "var(--ink-500)" }}>
            Enter your account email and we&apos;ll send you a reset link.
          </p>

          {submitted ? (
            <div
              className="text-center p-4 mb-4"
              style={{
                background: "var(--bg-sage-tint)",
                border: "1px solid var(--line)",
                borderRadius: 10,
              }}
            >
              <p className="text-sm" style={{ color: "var(--ink-700)" }}>
                If an account exists with this email, a password reset link has been sent.
                Check your inbox (and spam folder).
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>
                  Email
                </label>
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
              {error && (
                <p className="text-sm text-center" style={{ color: "var(--clay-ink)" }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="cd-btn cd-btn-primary w-full justify-center"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}

          <p className="text-center text-sm mt-6">
            <Link to="/login" className="hover:underline" style={{ color: "var(--sage-ink)", fontWeight: 500 }}>
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
