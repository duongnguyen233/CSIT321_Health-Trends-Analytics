import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import BrandMark from "../components/common/BrandMark";
import { resetPassword } from "../services/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
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
    if (!token) {
      setError("Invalid reset link. Request a new one from the login page.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ token, password });
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Reset failed.";
      setError(typeof detail === "string" ? detail : "Reset failed.");
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
            Choose a new password
          </h1>

          {!token ? (
            <div className="text-center">
              <p className="text-sm mb-4" style={{ color: "var(--clay-ink)" }}>
                This reset link is missing or invalid.
              </p>
              <Link to="/forgot-password" className="cd-btn cd-btn-primary inline-flex">
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 focus:outline-none"
                  style={inputStyle}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-700)" }}>
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full p-2.5 focus:outline-none"
                  style={inputStyle}
                  placeholder="Re-enter password"
                  required
                  minLength={8}
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
                {loading ? "Updating…" : "Update password"}
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
