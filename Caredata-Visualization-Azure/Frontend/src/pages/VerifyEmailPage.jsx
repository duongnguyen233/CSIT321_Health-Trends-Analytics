import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { verifyEmail } from "../services/api";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No verification token provided.");
      return;
    }
    verifyEmail(token)
      .then((data) => {
        if (data.access_token) {
          localStorage.setItem("token", data.access_token);
          if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
        }
        setStatus("success");
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(
          err.response?.data?.detail || "Verification failed. The link may be expired or invalid."
        );
      });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex flex-grow items-center justify-center px-4 mt-16">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          {status === "verifying" && (
            <>
              <div className="inline-block w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Verifying your email...</h2>
              <p className="text-gray-500 text-sm">Please wait a moment.</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Email verified!</h2>
              <p className="text-gray-500 text-sm mb-6">
                Your account is now active. You're all set to use CareData Portal.
              </p>
              <button
                onClick={() => navigate("/")}
                className="bg-primary text-white font-semibold px-6 py-2.5 rounded-md hover:bg-primary-hover transition"
              >
                Go to Dashboard
              </button>
            </>
          )}
          {status === "error" && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Verification failed</h2>
              <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
              <button
                onClick={() => navigate("/login")}
                className="bg-primary text-white font-semibold px-6 py-2.5 rounded-md hover:bg-primary-hover transition"
              >
                Go to Login
              </button>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
