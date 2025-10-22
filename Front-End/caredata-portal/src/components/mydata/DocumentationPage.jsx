import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import { useState } from "react";

export default function DocumentationPage() {
  const [selectedOptions, setSelectedOptions] = useState({
    includeData: true,
    includeCharts: true,
    includeSummary: true,
    includeRecommendations: false,
  });

  const handleChange = (option) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  const handleGenerate = () => {
    alert("Documentation generation started!\n\nSelected sections: " +
      Object.keys(selectedOptions)
        .filter((key) => selectedOptions[key])
        .join(", "));
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 max-w-7xl mx-auto gap-6">
        <MyDataSidebar activePage="Documentation" />

        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            Documentation Generator
          </h1>
          <p className="text-gray-600 mb-8">
            Choose which elements you want to include in your auto-generated
            documentation report. This tool can combine your submitted data,
            charts, and AI-generated summaries into a ready-to-export document.
          </p>

          <div className="space-y-4 mb-8">
            {Object.keys(selectedOptions).map((key) => (
              <div
                key={key}
                className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition"
              >
                <label className="text-gray-800 font-medium capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </label>
                <input
                  type="checkbox"
                  checked={selectedOptions[key]}
                  onChange={() => handleChange(key)}
                  className="w-5 h-5 text-orange-500 focus:ring-orange-400 rounded"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={handleGenerate}
              className="bg-orange-500 text-white px-6 py-3 rounded-md font-medium hover:bg-orange-600 transition shadow-sm"
            >
              Generate Documentation
            </button>

            <button
              className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-100 transition"
            >
              Export Last Report
            </button>
          </div>

          <div className="mt-10 bg-orange-50 border border-orange-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-orange-800 mb-2">
              💡 Tip:
            </h3>
            <p className="text-gray-700 leading-relaxed">
              You can customize your documentation to include only what matters.
              For example, if you’re preparing a compliance report, include data
              tables and charts. For internal presentations, add AI summaries and
              insights.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}