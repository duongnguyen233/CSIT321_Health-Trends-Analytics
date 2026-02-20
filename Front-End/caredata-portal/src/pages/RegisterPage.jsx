import { useState, useEffect } from "react";
import { registerUser, API_BASE_URL } from "../services/api";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { isCognitoEnabled, isCognitoGoogleEnabled } from "../config/amplify";
import { cognitoSignUp, cognitoSignInWithGoogleRedirect, cognitoConfirmSignUp, cognitoResendSignUpCode } from "../services/cognitoAuth";

export default function RegisterPage() {
  const useCognito = isCognitoEnabled();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [strength, setStrength] = useState("Weak");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState(["", "", "", "", "", ""]);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();

  const RESEND_COOLDOWN_SEC = 60;
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Auto-focus first input when verification form appears
  useEffect(() => {
    if (needsConfirmation) {
      setTimeout(() => {
        const firstInput = document.getElementById("code-0");
        if (firstInput) firstInput.focus();
      }, 100);
    }
  }, [needsConfirmation]);

  // --- Password Strength Checker ---
  const checkStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[0-9!@#$%^&*]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (pwd.length >= 12) score++;

    if (score >= 3) return "Strong";
    if (score === 2) return "Medium";
    return "Weak";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (name === "password") {
      setStrength(checkStrength(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (useCognito) {
        const result = await cognitoSignUp(
          form.email,
          form.password,
          form.first_name,
          form.last_name
        );
        if (result.needsConfirmation) {
          setNeedsConfirmation(true);
          setLoading(false);
        } else {
          setSuccess(true);
        }
        return;
      }
      await registerUser(form);
      setSuccess(true);
    } catch (error) {
      console.error(error);
      alert(
        "❌ Error registering user: " +
          (error.response?.data?.detail || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  // -------- Google Register / Login -----------
  const handleGoogleSuccess = async (credentialResponse) => {
    if (useCognito) {
      try {
        await cognitoSignInWithGoogleRedirect();
      } catch (err) {
        console.error(err);
        alert("Google sign-in redirect failed.");
      }
      return;
    }
    try {
      const id_token = credentialResponse.credential;
      if (!id_token) {
        alert("Google login failed: no credential");
        return;
      }
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Google login failed");
      }
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      const userRes = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (!userRes.ok) throw new Error("Failed to fetch user info");
      const userData = await userRes.json();
      localStorage.setItem("user", JSON.stringify(userData));
      navigate("/setup-account");
    } catch (err) {
      console.error(err);
      alert(err.message || "Google login failed");
    }
  };

  const handleGoogleError = () => {
    alert("Google login failed");
  };

  const handleCodeChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;
    
    const newCode = [...confirmationCode];
    newCode[index] = value;
    setConfirmationCode(newCode);
    
    // Auto-focus next box
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleCodePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      setConfirmationCode(pastedData.split(""));
      // Focus last box
      const lastInput = document.getElementById("code-5");
      if (lastInput) lastInput.focus();
    }
  };

  const handleCodeKeyDown = (index, e) => {
    // Handle backspace to go to previous box
    if (e.key === "Backspace" && !confirmationCode[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleConfirmCode = async (e) => {
    e.preventDefault();
    const codeString = confirmationCode.join("").trim();
    if (codeString.length !== 6) {
      alert("Please enter the complete 6-digit verification code.");
      return;
    }
    setConfirmLoading(true);
    try {
      await cognitoConfirmSignUp(form.email, codeString);
      setNeedsConfirmation(false);
      setConfirmationCode(["", "", "", "", "", ""]);
      setSuccess(true);
    } catch (err) {
      alert(err.message || "Invalid or expired code. Check your email and try again.");
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    try {
      await cognitoResendSignUpCode(form.email);
      setResendCooldown(RESEND_COOLDOWN_SEC);
      alert("Verification code resent. Check your email.");
    } catch (err) {
      alert(err.message || "Could not resend code. Try again in a minute.");
    } finally {
      setResendLoading(false);
    }
  };

  // Success Screen (only show after verification is complete)
  if (success && !needsConfirmation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center">
        <img
          src="/success.png"
          alt="Success"
          className="w-24 h-24 mb-6"
        />
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Account created successfully!
        </h2>
        <p className="text-gray-500 mb-8">
          Welcome aboard! Start your success journey with CareData!
        </p>
        <button
          onClick={() => navigate("/login")}
          className="bg-orange-500 text-white px-6 py-2.5 rounded-md font-medium hover:bg-orange-600 transition"
        >
          Let’s Start!
        </button>
      </div>
    );
  }

  // --- Registration Form ---
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex flex-grow items-stretch justify-center px-4 py-12 mt-16 min-h-[calc(100vh-8rem)]">
        <div className="flex flex-col md:flex-row w-full max-w-6xl bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Left Panel */}
          <div
            className="hidden md:flex relative flex-col justify-center items-center w-1/2 bg-cover bg-center text-white p-10"
            style={{
              backgroundImage: "url('banner.png')",
            }}
          >
            <div className="absolute inset-0 bg-white/25"></div>

            <div className="relative z-10 flex flex-col justify-between h-full text-center max-w-sm py-10">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  Welcome to Care Data
                </h1>
                <p className="text-gray-200 mb-8">
                  Your Gateway to Government Submission.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">
                  Seamless Integration
                </h2>
                <p className="text-gray-200 text-sm">
                  Effortlessly submit your data to Government Portal.
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel (Register Form) */}
          <div className="flex flex-col justify-center items-center w-full md:w-1/2 px-8 py-12 bg-white">
            <div className="w-full max-w-sm">
              {/* Logo and Title */}
              <div className="flex items-center justify-center mb-6">
                <img src="logo_black.png" alt="logo" className="w-8 h-8 mr-2" />
                <h2 className="text-xl font-bold text-gray-900">
                  Care Data Portal
                </h2>
              </div>

              {/* Tabs */}
              <div className="flex mb-6 border-b border-gray-200">
                <button
                  className="flex-1 py-2 font-medium text-gray-400 hover:text-gray-600"
                  onClick={() => navigate("/login")}
                >
                  Sign In
                </button>
                <button className="flex-1 py-2 font-medium text-gray-900 border-b-2 border-orange-500">
                  Sign Up
                </button>
              </div>

              {/* Email Verification Form */}
              {needsConfirmation ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <p className="text-sm text-amber-800 font-medium">
                      Check your email ({form.email}) for a verification code to confirm your account.
                    </p>
                    <p className="text-xs text-amber-700">
                      Verification emails can take a few minutes. Check your spam folder.
                    </p>
                    <form onSubmit={handleConfirmCode} className="flex flex-col gap-3">
                      <div className="flex justify-center gap-2">
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <input
                            key={index}
                            id={`code-${index}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={confirmationCode[index]}
                            onChange={(e) => handleCodeChange(index, e.target.value)}
                            onPaste={handleCodePaste}
                            onKeyDown={(e) => handleCodeKeyDown(index, e)}
                            className="w-12 h-12 text-center text-xl font-semibold border-2 border-gray-300 rounded-md focus:border-orange-500 focus:ring-2 focus:ring-orange-400 transition"
                            disabled={confirmLoading}
                            autoComplete="off"
                          />
                        ))}
                      </div>
                      <p className="text-xs text-amber-600 text-center">
                        Enter the 6-digit code sent to {form.email}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={confirmLoading}
                          className="flex-1 bg-orange-500 text-white py-2 rounded-md font-medium hover:bg-orange-600 transition disabled:opacity-60"
                        >
                          {confirmLoading ? "Verifying…" : "Verify Email"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNeedsConfirmation(false);
                            setConfirmationCode(["", "", "", "", "", ""]);
                          }}
                          disabled={confirmLoading}
                          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          Back
                        </button>
                      </div>
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
                    </form>
                  </div>
                </div>
              ) : (
              /* Registration Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* First + Last name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      name="first_name"
                      type="text"
                      value={form.first_name}
                      onChange={handleChange}
                      placeholder="Enter your first name"
                      className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-orange-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      name="last_name"
                      type="text"
                      value={form.last_name}
                      onChange={handleChange}
                      placeholder="Enter your last name"
                      className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-orange-400"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-orange-400"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-orange-400"
                    required
                  />

                  {/* Password Checklist */}
                  <ul className="mt-2 text-sm text-gray-500 space-y-1">
                    <li>
                      <span
                        className={
                          strength === "Strong"
                            ? "text-green-500"
                            : strength === "Medium"
                            ? "text-yellow-500"
                            : "text-red-500"
                        }
                      >
                        ✓ Password Strength: {strength}
                      </span>
                    </li>
                    <li>✓ Cannot contain your name or email address</li>
                    <li>✓ At least 8 characters</li>
                    <li>✓ Contains a number or symbol</li>
                  </ul>
                </div>

                {/* Terms checkbox */}
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" className="accent-orange-500" required />
                  I agree to the Terms of Service.
                </label>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-orange-500 text-white font-semibold rounded-md hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </button>
              </form>
              )}

              {/* OAuth buttons - only show when not verifying */}
              {!needsConfirmation && (
                <>
                  {/* Divider */}
                  <div className="flex items-center my-6">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="px-3 text-sm text-gray-500">OR</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {/* OAuth buttons */}
                  <div className="flex justify-center">
                    {useCognito && isCognitoGoogleEnabled() ? (
                      <button
                        type="button"
                        onClick={() => handleGoogleSuccess({ credential: null })}
                        className="w-full border rounded-md py-2 flex items-center justify-center gap-2 hover:bg-gray-50"
                      >
                        <img
                          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                          alt="Google"
                          className="w-5 h-5"
                        />
                        Sign up with Google
                      </button>
                    ) : !useCognito ? (
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        useOneTap={false}
                      />
                    ) : (
                      <span className="text-sm text-gray-500">Use the form above to sign up.</span>
                    )}
                  </div>

                  {/* Footer link */}
                  <p className="text-center text-sm mt-6 text-gray-600">
                    Already have an account?{" "}
                    <Link
                      to="/login"
                      className="text-orange-500 font-medium hover:underline"
                    >
                      Login
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
