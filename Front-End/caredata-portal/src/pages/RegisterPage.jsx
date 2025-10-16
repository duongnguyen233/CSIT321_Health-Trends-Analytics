import { useState } from "react";
import { registerUser } from "../services/api";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { Link, useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await registerUser(form);
      alert("✅ Registration successful!");
      console.log("User created:", response.data);
      navigate("/login");
    } catch (error) {
      console.error(error);
      alert("❌ Error registering user: " + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 pt-24">
        <div className="w-full max-w-md bg-white shadow-md rounded-xl p-8">
          <h2 className="text-2xl font-bold text-center mb-6">Sign Up</h2>

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
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-400"
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
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-400"
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
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-400"
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
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>

            {/* Terms checkbox */}
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" className="accent-blue-600" required />
              I agree to the Terms of Service.
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-gray-800 text-white font-semibold rounded-md hover:bg-gray-900 transition disabled:opacity-50"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="px-3 text-sm text-gray-500">Or sign up with:</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* OAuth buttons (keep for later) */}
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

          {/* Footer link */}
          <p className="text-center text-sm mt-6 text-gray-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-blue-600 font-medium hover:underline"
            >
              Login
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
