import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { Link } from "react-router-dom";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 pt-24">
        <div className="w-full max-w-md bg-white shadow-md rounded-xl p-8">
          <h2 className="text-2xl font-bold text-center mb-6">Sign Up</h2>

          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  placeholder="Placeholder"
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  placeholder="Placeholder"
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                placeholder="Placeholder"
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="Placeholder"
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" className="accent-blue-600" />
              Vestibulum faucibus odio vitae arcu lectus.
            </label>

            <button
              type="submit"
              className="w-full py-2 bg-gray-800 text-white font-semibold rounded-md hover:bg-gray-900 transition"
            >
              Create Account
            </button>
          </form>

          <div className="my-4 text-center text-sm text-gray-500">Or sign up with:</div>

          <div className="flex gap-3">
            <button className="flex-1 border rounded-md py-2 flex items-center justify-center gap-2 hover:bg-gray-50">
              <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg" alt="Google" className="w-4 h-4" />
              Google
            </button>
            <button className="flex-1 border rounded-md py-2 flex items-center justify-center gap-2 hover:bg-gray-50">
              <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple" className="w-4 h-4" />
              Apple
            </button>
          </div>

          <p className="text-center text-sm mt-6 text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">
              Login
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
