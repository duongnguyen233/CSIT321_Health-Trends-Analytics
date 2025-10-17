import { useState } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";

export default function UploadCSVPage() {
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (file) {
      alert(`File uploaded: ${file.name}`);
      // TODO: implement your actual upload logic (API call)
    } else {
      alert("Please select a CSV file first.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 pt-24 pb-12">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-center text-gray-900 mb-2">
            Upload Your Data
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Upload a CSV file to analyze and visualize your healthcare data.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File upload area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition cursor-pointer">
              <input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
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
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6H16a5 5 0 011 9.9m-5 3.1v-8m0 0l-3 3m3-3l3 3"
                  />
                </svg>
                <span className="text-gray-700 font-medium">
                  {file ? file.name : "Click or drag a CSV file to upload"}
                </span>
                <span className="text-gray-500 text-sm mt-1">
                  (Only .csv files are supported)
                </span>
              </label>
            </div>

            {/* Upload button */}
            <button
              type="submit"
              className="w-full bg-primary text-white py-2.5 rounded-md font-medium hover:bg-orange-600 transition"
            >
              Upload File
            </button>
          </form>

          {/* Tips */}
          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-5 text-sm text-gray-700">
            <h3 className="font-semibold mb-2">Upload Guidelines:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Ensure your file is in .CSV format.</li>
              <li>Each column should have a clear header.</li>
              <li>Do not include empty rows or special characters.</li>
              <li>Maximum file size: 5 MB.</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
