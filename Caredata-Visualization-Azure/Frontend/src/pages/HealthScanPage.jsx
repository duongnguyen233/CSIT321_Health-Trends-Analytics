import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { analyzeHealthScanImages, saveMyData } from "../services/api";
import { HEALTH_SCAN_RESULT_KEY } from "../constants";

const ACCEPT_IMAGE = "image/*";
const MAX_SIZE_MB = 10;
const MAX_IMAGES = 5;

export default function HealthScanPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastPromptSent, setLastPromptSent] = useState(null);
  const [showPromptDetail, setShowPromptDetail] = useState(false);
  const [analysisJustComplete, setAnalysisJustComplete] = useState(false);
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setError("");
    setAnalysisJustComplete(false);
    setLastPromptSent(null);
    if (selected.length === 0) {
      setFiles([]);
      setPreviews([]);
      return;
    }
    const oversized = selected.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setError(`Each file must be under ${MAX_SIZE_MB} MB.`);
      setFiles([]);
      setPreviews([]);
      return;
    }
    const next = selected.slice(0, MAX_IMAGES);
    if (selected.length > MAX_IMAGES) setError(`Maximum ${MAX_IMAGES} images. Only the first ${MAX_IMAGES} were added.`);
    setFiles(next);
    const loadPreviews = next.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });
    Promise.all(loadPreviews).then(setPreviews);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setError("");
  };

  const clearAll = () => {
    setFiles([]);
    setPreviews([]);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!files.length) {
      setError("Please select at least one image.");
      return;
    }
    setError("");
    setIsAnalyzing(true);
    try {
      const result = await analyzeHealthScanImages(files);
      if (result.debug?.promptSent) {
        console.log("[Health Scan] Prompt that was sent:", result.debug.promptSent);
        setLastPromptSent(result.debug.promptSent);
      } else {
        setLastPromptSent(null);
      }
      console.log("[Health Scan] ChatGPT/API response:", result);
      console.log("[Health Scan] Recommendations in response:", result.recommendations ? "yes" : "no", result.recommendations);
      const { debug, ...dataToSave } = result;
      // Save to user account (DynamoDB) so My Data shows it (without debug)
      try {
        await saveMyData(dataToSave);
      } catch (err) {
        console.warn("[Health Scan] Save to server failed, using localStorage:", err?.response?.data || err.message);
        localStorage.setItem(HEALTH_SCAN_RESULT_KEY, JSON.stringify(dataToSave));
      }
      setAnalysisJustComplete(true);
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
            Upload 1–{MAX_IMAGES} images of your health records. We’ll analyze them and display insights in My Data.
          </p>

          <form onSubmit={handleAnalyze} className="space-y-6">
            {/* Upload area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition cursor-pointer ${
                files.length ? "border-primary bg-primary-light/30" : "border-gray-300 hover:border-primary"
              }`}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT_IMAGE}
                multiple
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
                  {files.length ? `${files.length} image(s) selected` : "Click to upload (max " + MAX_IMAGES + " images)"}
                </span>
                <span className="text-gray-500 text-sm mt-1">
                  PNG, JPG, or WEBP (max {MAX_SIZE_MB} MB each)
                </span>
              </div>
            </div>

            {/* Previews */}
            {previews.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Previews</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-sm text-primary hover:underline"
                  >
                    Clear all
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {previews.map((src, i) => (
                    <div key={i} className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square">
                      <img
                        src={src}
                        alt={`Preview ${i + 1}`}
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 bg-gray-800/80 text-white rounded-full p-1 hover:bg-gray-900 transition"
                        aria-label="Remove image"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <span className="absolute bottom-1 left-1 text-xs text-white bg-dark/50 rounded px-1.5 py-0.5">
                        {files[i]?.name?.slice(0, 12)}{files[i]?.name?.length > 12 ? "…" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!files.length || isAnalyzing}
              className="w-full bg-primary text-white py-2.5 rounded-md font-medium hover:bg-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? "Analyzing…" : "Analyze health record" + (files.length > 1 ? "s" : "")}
            </button>
          </form>

          {analysisJustComplete && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-800 mb-3">Analysis saved. View results in My Data.</p>
              {lastPromptSent ? (
                <div className="text-left">
                  <button
                    type="button"
                    onClick={() => setShowPromptDetail((v) => !v)}
                    className="text-sm font-medium text-green-700 hover:underline mb-2"
                  >
                    {showPromptDetail ? "Hide" : "Show"} prompt sent to ChatGPT (verify it&apos;s correct)
                  </button>
                  {showPromptDetail && (
                    <div className="mt-2 space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">System prompt:</span>
                        <pre className="mt-1 p-3 bg-gray-100 rounded overflow-auto max-h-48 text-xs whitespace-pre-wrap break-words">
                          {lastPromptSent.system}
                        </pre>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">User text:</span>
                        <pre className="mt-1 p-3 bg-gray-100 rounded overflow-auto text-xs whitespace-pre-wrap">
                          {lastPromptSent.userText}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-amber-700">
                  Prompt not returned — backend may be an older version. Restart or redeploy the backend to see the prompt here and get the new 4-section format.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setAnalysisJustComplete(false);
                  setLastPromptSent(null);
                  setShowPromptDetail(false);
                  navigate("/mydata");
                }}
                className="mt-3 w-full bg-primary text-white py-2 rounded-md font-medium hover:bg-primary-hover transition"
              >
                Go to My Data
              </button>
            </div>
          )}

          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-5 text-sm text-gray-700">
            <h3 className="font-semibold mb-2">Guidelines</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Upload 1–{MAX_IMAGES} clear photos or scans (lab results, discharge summary, etc.).</li>
              <li>Supported formats: PNG, JPG, WEBP. Max {MAX_SIZE_MB} MB per image.</li>
              <li>Multiple images are combined into one summary in My Data.</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
