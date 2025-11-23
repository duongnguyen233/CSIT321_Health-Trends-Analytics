// src/pages/LoginPage.jsx
import { useState } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  // ------------------------------------------------------------
  // EMAIL / PASSWORD LOGIN
  // ------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) throw new Error("Invalid email or password");

      const data = await response.json();
      const token = data.access_token;
      localStorage.setItem("token", token);

      // Get current user
      const userRes = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userRes.ok) throw new Error("Failed to fetch user info");

      const userData = await userRes.json();
      localStorage.setItem("user", JSON.stringify(userData));

      if (remember) {
        localStorage.setItem("rememberEmail", email);
      } else {
        localStorage.removeItem("rememberEmail");
      }

      window.location.href = "/";
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Login failed");
    }
  };

  // ------------------------------------------------------------
  // GOOGLE LOGIN
  // ------------------------------------------------------------
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: credentialResponse.credential,
        }),
      });

      if (!res.ok) throw new Error("Google login failed");

      const data = await res.json();

      // Save token
      localStorage.setItem("token", data.access_token);

      // Save user
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

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                  type="submit"
                  className="w-full bg-orange-500 text-white py-2.5 rounded-md font-medium hover:bg-orange-600 transition"
                >
                  Sign In
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="px-3 text-sm text-gray-500">OR</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* GOOGLE LOGIN BUTTON (Working) */}
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  width="100%"
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
