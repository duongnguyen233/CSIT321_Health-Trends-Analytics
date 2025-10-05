import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow flex items-center justify-center px-4 pt-24">
        <div className="bg-white w-full max-w-md rounded-2xl shadow p-8">
          <h2 className="text-3xl font-semibold text-center text-gray-900 mb-8">Welcome back</h2>

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-gray-300" placeholder="Placeholder" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-gray-300" placeholder="Placeholder" />
              <div className="flex justify-between items-center mt-2 text-sm">
                <label className="flex items-center">
                  <input type="checkbox" className="h-4 w-4 border-gray-300 rounded mr-2" />
                  <span className="text-gray-600">Remember me</span>
                </label>
                <Link to="#" className="text-blue-600 hover:underline">Forgot Password?</Link>
              </div>
            </div>

            {/* PRIMARY: black button */}
            <button type="submit" className="w-full bg-gray-900 text-white py-2.5 rounded-md font-medium hover:bg-black transition">
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
              <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg" alt="Google" className="w-4 h-4" />
              Google
            </button>
            <button className="flex-1 border rounded-md py-2 flex items-center justify-center gap-2 hover:bg-gray-50">
              <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple" className="w-4 h-4" />
              Apple
            </button>
          </div>

          <p className="text-center text-sm text-gray-600 mt-6">
            No account yet?{" "}
            <Link to="/register" className="text-blue-600 hover:underline">Sign up</Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
