import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import MyDataSidebar from "../components/mydata/MyDataSidebar";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { DOMAINS } from "../components/common/domains";

export default function MyDataPage() {
  const navigate = useNavigate();

  // ✅ Use shared DOMAINS list instead of hardcoded array
  const [data] = useState(
    DOMAINS.map((domain, index) => ({
      id: index + 1,
      domain,
      completion:
        index % 3 === 0
          ? "Completed"
          : index % 3 === 1
          ? "In Progress"
          : "Not Started",
      lastUpdated:
        index % 3 === 0
          ? "2025-09-30"
          : index % 3 === 1
          ? "2025-09-25"
          : "—",
    }))
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto gap-6 w-full">
        {/* Sidebar */}
        <MyDataSidebar activePage="My Data" />

        {/* Main Content */}
        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3 text-center">
            My Data
          </h1>
          <p className="text-gray-600 text-center mb-8">
            View and manage the data you’ve submitted from your Quality Indicator Questionnaire.
          </p>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left text-gray-700 font-semibold py-3 px-4">
                    Domain
                  </th>
                  <th className="text-left text-gray-700 font-semibold py-3 px-4">
                    Completion
                  </th>
                  <th className="text-left text-gray-700 font-semibold py-3 px-4">
                    Last Updated
                  </th>
                  <th className="text-center text-gray-700 font-semibold py-3 px-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-gray-50 transition"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {row.domain}
                    </td>
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
                    <td className="py-3 px-4 text-gray-600">
                      {row.lastUpdated}
                    </td>
                    <td className="text-center py-3 px-4">
                      <button
                        onClick={() =>
                          navigate(`/domain/${row.id}`, {
                            state: {
                              completion: row.completion,
                              domainName: row.domain,
                            },
                          })
                        }
                        className="text-orange-600 hover:text-orange-700 font-medium"
                      >
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
            <h3 className="font-semibold text-lg text-gray-800 mb-3">
              Data Summary:
            </h3>
            <ul className="text-gray-700 list-disc list-inside space-y-1 text-sm">
              <li>
                Total domains completed:{" "}
                <span className="font-semibold text-orange-600">8 / 14</span>
              </li>
              <li>
                In progress:{" "}
                <span className="font-semibold text-yellow-700">4</span>
              </li>
              <li>
                Not started:{" "}
                <span className="font-semibold text-gray-600">2</span>
              </li>
              <li>
                Last submission update:{" "}
                <span className="font-semibold">October 1, 2025</span>
              </li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex justify-center gap-4 mt-10">
            <button className="bg-white border border-gray-300 px-4 py-2 rounded-md text-gray-700 font-medium hover:bg-gray-100 transition">
              Export as CSV
            </button>
            <button
              onClick={() => navigate("/questionnaire")}
              className="bg-orange-500 text-white px-5 py-2 rounded-md font-medium hover:bg-orange-600 transition"
            >
              Update Questionnaire
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
