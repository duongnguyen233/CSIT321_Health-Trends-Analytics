import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { analyzeHealthScanImage, saveMyData } from "../services/api";
import { HEALTH_SCAN_RESULT_KEY } from "../constants";

const ACCEPT_IMAGE = "image/*";
const MAX_SIZE_MB = 10;

export default function HealthScanPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    setError("");
    if (!selected) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (selected.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_SIZE_MB} MB.`);
      setFile(null);
      setPreview(null);
      return;
    }
    setFile(selected);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(selected);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an image first.");
      return;
    }
    setError("");
    setIsAnalyzing(true);
    try {
      const result = await analyzeHealthScanImage(file);
      // Save to user account (DynamoDB) so My Data shows it
      try {
        await saveMyData(result);
      } catch (_) {
        // Fallback: keep in localStorage so My Data can still show it
        localStorage.setItem(HEALTH_SCAN_RESULT_KEY, JSON.stringify(result));
      }
      navigate("/mydata");
    } catch (err) {
      let msg = err.response?.data?.detail || err.message || "Analysis failed.";
      if (err.code === "ERR_NETWORK" || err.message?.includes("Connection refused") || err.message?.includes("Failed to fetch")) {
        msg = "Cannot reach the server. Start the backend (e.g. uvicorn app.main:app --reload --port 8000 in the Back-End folder).";
      }
      setError(Array.isArray(msg) ? msg.join(" ") : msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 mt-24 pb-12 pt-12">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-center text-gray-900 mb-2">
            Health Scan
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Upload an image of your health record. We’ll analyze it and display insights and charts in My Data.
          </p>

          <form onSubmit={handleAnalyze} className="space-y-6">
            {/* Upload area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition cursor-pointer ${
                file ? "border-primary bg-orange-50/30" : "border-gray-300 hover:border-primary"
              }`}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT_IMAGE}
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 text-gray-400 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-gray-700 font-medium">
                  {file ? file.name : "Click or drag an image to upload"}
                </span>
                <span className="text-gray-500 text-sm mt-1">
                  PNG, JPG, or WEBP (max {MAX_SIZE_MB} MB)
                </span>
              </div>
            </div>

            {/* Preview */}
            {preview && (
              <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full max-h-64 object-contain"
                />
                <button
                  type="button"
                  onClick={clearFile}
                  className="absolute top-2 right-2 bg-gray-800/80 text-white rounded-full p-1.5 hover:bg-gray-900 transition"
                  aria-label="Remove image"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!file || isAnalyzing}
              className="w-full bg-primary text-white py-2.5 rounded-md font-medium hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? "Analyzing…" : "Analyze health record"}
            </button>
          </form>

          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-5 text-sm text-gray-700">
            <h3 className="font-semibold mb-2">Guidelines</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Use a clear photo or scan of your health record (lab results, discharge summary, etc.).</li>
              <li>Supported formats: PNG, JPG, WEBP. Max size: {MAX_SIZE_MB} MB.</li>
              <li>Analysis results and charts will appear under My Data.</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
