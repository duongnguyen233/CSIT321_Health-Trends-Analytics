// src/pages/LoginPage.jsx
import { useState, useEffect } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { isCognitoEnabled, isCognitoGoogleEnabled } from "../config/amplify";
import {
  cognitoSignIn,
  cognitoSignInWithGoogleRedirect,
  getCognitoIdToken,
  cognitoSignOut,
  cognitoConfirmSignUp,
  cognitoConfirmSignIn,
  cognitoResendSignUpCode,
} from "../services/cognitoAuth";
import { API_BASE_URL } from "../services/api";

async function setUserFromApi(token) {
  const url = `${API_BASE_URL}/auth/me`;
  const userRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) {
    throw new Error("Failed to fetch user info");
  }
  const userData = await userRes.json();
  localStorage.setItem("user", JSON.stringify(userData));
}

export default function LoginPage() {
  const navigate = useNavigate();
  const useCognito = isCognitoEnabled();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [confirmStep, setConfirmStep] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ------------------------------------------------------------
  // EMAIL / PASSWORD LOGIN
  // ------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (useCognito) {
        try {
          const result = await cognitoSignIn(email, password);
          if (result.needsConfirmation) {
            setError("");
            setNeedsConfirmation(true);
            setConfirmStep(result.nextStep?.signInStep || "CONFIRM_SIGN_UP");
            return;
          }
          const token = result.token || (await getCognitoIdToken());
          if (!token) throw new Error("Sign-in failed");
          localStorage.setItem("token", token);
          await setUserFromApi(token);
          if (remember) localStorage.setItem("rememberEmail", email);
          else localStorage.removeItem("rememberEmail");
          window.location.href = "/";
          return;
        } catch (err) {
          // Handle case where user is already authenticated
          if (err?.name === "UserAlreadyAuthenticatedException" || err?.message?.includes("already a signed in user")) {
            try {
              const token = await getCognitoIdToken();
              if (token) {
                localStorage.setItem("token", token);
                await setUserFromApi(token);
                if (remember) localStorage.setItem("rememberEmail", email);
                else localStorage.removeItem("rememberEmail");
                window.location.href = "/";
                return;
              }
            } catch (e2) {
              // If we can't get token, sign out and try again
              try {
                await cognitoSignOut();
              } catch (_) {
                // Ignore sign out errors
              }
              throw err; // Re-throw original error
            }
          }
          throw err; // Re-throw if not UserAlreadyAuthenticatedException
        }
      }
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error("Invalid email or password");
      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      await setUserFromApi(data.access_token);
      if (remember) localStorage.setItem("rememberEmail", email);
      else localStorage.removeItem("rememberEmail");
      window.location.href = "/";
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Login failed");
    }
  };

  const handleConfirmCode = async (e) => {
    e.preventDefault();
    if (!confirmationCode.trim()) {
      setError("Enter the verification code from your email or SMS.");
      return;
    }
    setError("");
    setConfirmLoading(true);
    try {
      const isSignUpConfirm = confirmStep === "CONFIRM_SIGN_UP";
      if (isSignUpConfirm) {
        await cognitoConfirmSignUp(email, confirmationCode);
        setNeedsConfirmation(false);
        setConfirmationCode("");
        setConfirmStep(null);
        setError("");
        setConfirmLoading(false);
        setError("Account confirmed. Sign in with your email and password above.");
        return;
      }
      const result = await cognitoConfirmSignIn(confirmationCode);
      if (result.needsConfirmation) {
        setError("Invalid or expired code. Try again or request a new code.");
        setConfirmLoading(false);
        return;
      }
      const token = result.token || (await getCognitoIdToken());
      if (!token) throw new Error("Sign-in failed");
      localStorage.setItem("token", token);
      await setUserFromApi(token);
      if (remember) localStorage.setItem("rememberEmail", email);
      else localStorage.removeItem("rememberEmail");
      window.location.href = "/";
    } catch (err) {
      console.error("Confirm error:", err);
      setError(err.message || "Invalid or expired code. Check your email/SMS and try again.");
    } finally {
      setConfirmLoading(false);
    }
  };

  const cancelConfirmation = () => {
    setNeedsConfirmation(false);
    setConfirmationCode("");
    setConfirmStep(null);
    setError("");
  };

  const RESEND_COOLDOWN_SEC = 60;
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleResendCode = async () => {
    if (resendCooldown > 0 || resendLoading || confirmStep !== "CONFIRM_SIGN_UP") return;
    setResendLoading(true);
    setError("");
    try {
      await cognitoResendSignUpCode(email);
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(err.message || "Could not resend code. Try again in a minute.");
    } finally {
      setResendLoading(false);
    }
  };

  // ------------------------------------------------------------
  // GOOGLE LOGIN
  // ------------------------------------------------------------
  const handleGoogleSuccess = async (credentialResponse) => {
    console.log("[CareData Auth] handleGoogleSuccess: useCognito =", useCognito);
    if (useCognito) {
      try {
        // If we have no token in localStorage, ensure Cognito is signed out so re-login after logout does full redirect
        const hasLocalToken = !!localStorage.getItem("token");
        if (!hasLocalToken) {
          try {
            await cognitoSignOut();
          } catch (_) {}
        }
        const existingToken = await getCognitoIdToken();
        if (existingToken) {
          localStorage.setItem("token", existingToken);
          await setUserFromApi(existingToken);
          window.location.href = "/";
          return;
        }
        // Always sign out before redirecting to force Google account selection
        try {
          await cognitoSignOut();
        } catch (_) {
          // Ignore if already signed out
        }
        await cognitoSignInWithGoogleRedirect(true); // Pass true to force account selection
      } catch (err) {
        if (err?.name === "UserAlreadyAuthenticatedException" || err?.message?.includes("already a signed in user")) {
          try {
            const token = await getCognitoIdToken();
            if (token) {
              localStorage.setItem("token", token);
              await setUserFromApi(token);
              window.location.href = "/";
              return;
            }
          } catch (e2) {
            // Silent fail
          }
        }
        setError("Google sign-in redirect failed.");
      }
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      if (!res.ok) throw new Error("Google login failed");
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/";
    } catch (err) {
      console.error("Google Login Error:", err);
      setError("Google login failed. Please try again.");
    }
  };

  const handleGoogleError = () => {
    setError("Google authentication failed");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex flex-grow items-stretch justify-center px-4 py-12 mt-16 min-h-[calc(100vh-3.1rem)]">
        <div className="flex flex-col md:flex-row w-full max-w-6xl bg-white rounded-2xl shadow-lg overflow-hidden">

          {/* Left Panel */}
          <div
            className="hidden md:flex relative flex-col justify-center items-center w-1/2 bg-cover bg-center text-white p-10"
            style={{ backgroundImage: "url('banner.png')" }}
          >
            <div className="absolute inset-0 bg-white/25"></div>

            <div className="relative z-10 flex flex-col justify-between h-full text-center max-w-sm py-10">
              <div>
                <h1 className="text-3xl font-bold mb-2">Welcome to Care Data</h1>
                <p className="text-gray-200 mb-8">
                  Your Gateway to Government Submission.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">Seamless Integration</h2>
                <p className="text-gray-200 text-sm">
                  Effortlessly submit your data to Government Portal.
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex flex-col justify-center items-center w-full md:w-1/2 px-8 py-12 bg-white">
            <div className="w-full max-w-sm">

              {/* Logo */}
              <div className="flex items-center justify-center mb-6">
                <img src="logo_black.png" alt="logo" className="w-8 h-8 mr-2" />
                <h2 className="text-xl font-bold text-gray-900">Care Data Portal</h2>
              </div>

              {/* Tabs */}
              <div className="flex mb-6 border-b border-gray-200">
                <button className="flex-1 py-2 font-medium text-gray-900 border-b-2 border-orange-500">
                  Sign In
                </button>
                <button
                  className="flex-1 py-2 font-medium text-gray-400 hover:text-gray-600"
                  onClick={() => navigate("/register")}
                >
                  Sign Up
                </button>
              </div>

              {/* Email Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-orange-400"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-orange-400"
                    placeholder="Enter Password"
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="accent-orange-500"
                    />
                    Remember me
                  </label>
                  <a href="/forgot-password" className="text-orange-500 hover:underline">
                    Forgot Password?
                  </a>
                </div>

                {needsConfirmation && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <p className="text-sm text-amber-800 font-medium">
                      {confirmStep === "CONFIRM_SIGN_UP"
                        ? "Check your email for a verification code to confirm your account."
                        : "Enter the verification code sent to your email or phone."}
                    </p>
                    <p className="text-xs text-amber-700">
                      Verification emails can take a few minutes. Check your spam folder.
                    </p>
                    <form onSubmit={handleConfirmCode} className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={confirmationCode}
                        onChange={(e) => setConfirmationCode(e.target.value)}
                        placeholder="Verification code"
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-orange-400"
                        autoComplete="one-time-code"
                        disabled={confirmLoading}
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={confirmLoading}
                          className="flex-1 bg-orange-500 text-white py-2 rounded-md font-medium hover:bg-orange-600 transition disabled:opacity-60"
                        >
                          {confirmLoading ? "Verifying…" : "Verify"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelConfirmation}
                          disabled={confirmLoading}
                          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                      {confirmStep === "CONFIRM_SIGN_UP" && (
                        <button
                          type="button"
                          onClick={handleResendCode}
                          disabled={confirmLoading || resendLoading || resendCooldown > 0}
                          className="text-sm text-orange-600 hover:text-orange-700 hover:underline disabled:opacity-60 disabled:no-underline"
                        >
                          {resendLoading
                            ? "Sending…"
                            : resendCooldown > 0
                              ? `Resend code in ${resendCooldown}s`
                              : "Resend verification code"}
                        </button>
                      )}
                    </form>
                  </div>
                )}

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                {!needsConfirmation && (
                  <button
                    type="submit"
                    className="w-full bg-orange-500 text-white py-2.5 rounded-md font-medium hover:bg-orange-600 transition"
                  >
                    Sign In
                  </button>
                )}
              </form>

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="px-3 text-sm text-gray-500">OR</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Google: only show when Cognito Hosted UI + Google is configured */}
              <div className="flex justify-center">
                {useCognito && isCognitoGoogleEnabled() ? (
                  <button
                    type="button"
                    onClick={() => handleGoogleSuccess({ credential: null })}
                    className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-md py-2.5 font-medium hover:bg-gray-50 transition"
                  >
                    <img
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      alt="Google"
                      className="w-5 h-5"
                    />
                    Sign in with Google
                  </button>
                ) : !useCognito ? (
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    width="100%"
                  />
                ) : (
                  <p className="text-sm text-gray-500 text-center">
                    Use email and password above. To enable Google, configure Cognito Hosted UI (see DEPLOY-AWS-SERVERLESS.md).
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
