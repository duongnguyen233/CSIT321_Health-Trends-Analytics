import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function LoginPage() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // Send login request to FastAPI
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });


      if (!response.ok) {
        throw new Error("Invalid email or password");
      }

      const data = await response.json();
      const token = data.access_token;

      //  Save token immediately
      localStorage.setItem("token", token);

      // Fetch current user info using token
      const userRes = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userRes.ok) {
        throw new Error("Failed to fetch user info");
      }

      const userData = await userRes.json();

      // Save user info in localStorage
      localStorage.setItem("user", JSON.stringify(userData));

      // Update AuthContext (optional but good practice)
      login({
        firstName: userData.first_name,
        lastName: userData.last_name,
        token,
      });

      // Redirect to homepage
      window.location.href = "/";
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow flex items-center justify-center px-4 pt-24">
        <div className="bg-white w-full max-w-md rounded-2xl shadow p-8">
          <h2 className="text-3xl font-semibold text-center text-gray-900 mb-8">
            Welcome back
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-gray-300"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-gray-300"
                placeholder="********"
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-gray-900 text-white py-2.5 rounded-md font-medium hover:bg-black transition"
            >
              Log In
            </button>
          </form>

          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="px-3 text-sm text-gray-500">Or sign in with:</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="flex gap-3">
            <button className="flex-1 border rounded-md py-2 flex items-center justify-center gap-2 hover:bg-gray-50">
              <img
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg"
                alt="Google"
                className="w-4 h-4"
              />
              Google
            </button>
            <button className="flex-1 border rounded-md py-2 flex items-center justify-center gap-2 hover:bg-gray-50">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"
                alt="Apple"
                className="w-4 h-4"
              />
              Apple
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
