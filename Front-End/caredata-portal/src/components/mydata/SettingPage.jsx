import { useState } from "react";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";

export default function SettingPage() {
  const [settings, setSettings] = useState({
    algorithm: "Random Forest",
    aiAssist: true,
    autoRefresh: "Weekly",
    anonymizeData: false,
  });

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = () => {
    console.log("Saved settings:", settings);
    alert("✅ Settings saved successfully!");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto gap-6 w-full">
        {/* Sidebar */}
        <MyDataSidebar activePage="Settings" />

        {/* Main Settings Content */}
        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3 text-center">
            Data Generation Settings
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Customize how your analytics and insights are generated.
          </p>

          <div className="space-y-8">
            {/* Algorithm Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Algorithm Selection
              </h3>
              <select
                name="algorithm"
                value={settings.algorithm}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
              >
                <option value="Random Forest">Random Forest</option>
                <option value="Linear Regression">Linear Regression</option>
                <option value="Naive Bayes">Naive Bayes</option>
                <option value="KNN Classifier">KNN Classifier</option>
              </select>
              <p className="text-sm text-gray-500 mt-2">
                Select the model used to generate prediction insights.
              </p>
            </div>

            {/* AI Assistance */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                AI Assistance
              </h3>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="aiAssist"
                  checked={settings.aiAssist}
                  onChange={handleChange}
                  className="w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="text-gray-700">
                  Enable AI-assisted recommendations and insights
                </span>
              </label>
            </div>

            {/* Data Refresh Frequency */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Data Refresh Frequency
              </h3>
              <div className="flex gap-4 flex-wrap">
                {["Daily", "Weekly", "Monthly"].map((option) => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="autoRefresh"
                      value={option}
                      checked={settings.autoRefresh === option}
                      onChange={handleChange}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Data Privacy */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Data Privacy
              </h3>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="anonymizeData"
                  checked={settings.anonymizeData}
                  onChange={handleChange}
                  className="w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="text-gray-700">
                  Anonymize sensitive identifiers in analytics reports
                </span>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-center mt-10">
            <button
              onClick={handleSave}
              className="bg-orange-500 text-white px-6 py-2 rounded-md font-medium hover:bg-orange-600 transition"
            >
              Save Settings
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
