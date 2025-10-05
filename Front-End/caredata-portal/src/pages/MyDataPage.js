import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import { useState } from "react";

export default function MyDataPage() {
  const [data] = useState([
    {
      id: 1,
      domain: "Pressure Injuries",
      indicator: "New or worsened injuries",
      completion: "Completed",
      lastUpdated: "2025-09-15",
    },
    {
      id: 2,
      domain: "Restrictive Practices",
      indicator: "Physical and chemical restraint uses",
      completion: "In Progress",
      lastUpdated: "2025-09-20",
    },
    {
      id: 3,
      domain: "Unplanned Weight Loss – Significant",
      indicator: "≥5% loss in 30 days",
      completion: "Completed",
      lastUpdated: "2025-09-25",
    },
    {
      id: 4,
      domain: "Medication – Polypharmacy",
      indicator: "≥9 medications per resident",
      completion: "Not Started",
      lastUpdated: "—",
    },
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      {/* Main Section */}
      <main className="flex-grow pt-24 pb-12 px-4 sm:px-6 flex justify-center">
        <div className="bg-white w-full max-w-6xl rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3 text-center">
            My Data Dashboard
          </h1>
          <p className="text-gray-600 text-center mb-8">
            View and manage the data you’ve submitted from your Quality Indicator Questionnaire.
          </p>

          {/* Table Section */}
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left text-gray-700 font-semibold py-3 px-4">Domain</th>
                  <th className="text-left text-gray-700 font-semibold py-3 px-4">Indicator</th>
                  <th className="text-left text-gray-700 font-semibold py-3 px-4">Completion</th>
                  <th className="text-left text-gray-700 font-semibold py-3 px-4">Last Updated</th>
                  <th className="text-center text-gray-700 font-semibold py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-gray-50 transition"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900">{row.domain}</td>
                    <td className="py-3 px-4 text-gray-700">{row.indicator}</td>
                    <td>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          row.completion === "Completed"
                            ? "bg-green-100 text-green-700"
                            : row.completion === "In Progress"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {row.completion}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{row.lastUpdated}</td>
                    <td className="text-center py-3 px-4">
                      <button className="text-blue-600 hover:text-blue-800 font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Section */}
          <div className="mt-10 bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-lg text-gray-800 mb-3">Data Summary:</h3>
            <ul className="text-gray-700 list-disc list-inside space-y-1 text-sm">
              <li>
                Total domains completed:{" "}
                <span className="font-semibold text-green-700">2 / 13</span>
              </li>
              <li>
                In progress:{" "}
                <span className="font-semibold text-yellow-700">1</span>
              </li>
              <li>
                Not started:{" "}
                <span className="font-semibold text-gray-600">10</span>
              </li>
              <li>
                Last submission update:{" "}
                <span className="font-semibold">September 25, 2025</span>
              </li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex justify-center gap-4 mt-10">
            <button className="bg-white border border-gray-300 px-4 py-2 rounded-md text-gray-700 font-medium hover:bg-gray-100 transition">
              Export as CSV
            </button>
            <button className="bg-gray-900 text-white px-5 py-2 rounded-md font-medium hover:bg-black transition">
              Update Questionnaire
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
