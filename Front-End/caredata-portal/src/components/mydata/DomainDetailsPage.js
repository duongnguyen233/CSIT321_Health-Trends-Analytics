import { useParams, useNavigate, useLocation } from "react-router-dom";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const mockDomainData = Array.from({ length: 14 }, (_, i) => ({
  id: i + 1,
  name: `Domain ${i + 1}`,
  score: Math.floor(Math.random() * 100),
  incidents: Math.floor(Math.random() * 50),
  residents: 100 + Math.floor(Math.random() * 50),
}));

const domainTitles = [
  "Pressure Injuries",
  "Restrictive Practices",
  "Unplanned Weight Loss – Significant",
  "Unplanned Weight Loss – Consecutive",
  "Falls and Major Injury",
  "Medication – Polypharmacy",
  "Medication – Antipsychotics",
  "Activities of Daily Living (ADLs)",
  "Incontinence Care (IAD)",
  "Hospitalisation",
  "Workforce",
  "Consumer Experience (QCE-ACC)",
  "Quality of Life (QOL-ACC)",
  "Allied Health Interventions",
];

export default function DomainDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const completionStatus = location.state?.completion || "Completed";

  const domain = mockDomainData.find((d) => d.id === Number(id));
  const domainName = domainTitles[Number(id) - 1] || "Domain Analysis";
  const isDataAvailable = completionStatus !== "Not Started" && completionStatus !== "In Progress";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex-grow pt-24 pb-12 px-4 sm:px-6 flex justify-center">
        <div className="bg-white w-full max-w-6xl rounded-2xl shadow p-8 border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">
              Domain {id}: {domainName} Analysis
            </h1>
            <button
              onClick={() => navigate("/mydata")}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to My Data
            </button>
          </div>

          {!isDataAvailable ? (
            <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No Data Available
              </h3>
              <p className="text-gray-600 mb-6">
                Data for <span className="font-medium">{domainName}</span> has not been entered yet.
                Please complete this domain in your questionnaire to view analytics and insights.
              </p>
              <button
                onClick={() => navigate("/questionnaire")}
                className="bg-blue-700 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-800 transition"
              >
                Go to Questionnaire Form
              </button>
            </div>
          ) : (
            <>
              {/* Charts Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Domain Performance (Radar)
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <RadarChart data={mockDomainData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" />
                      <PolarRadiusAxis />
                      <Radar
                        name="Score"
                        dataKey="score"
                        stroke="#2563eb"
                        fill="#3b82f6"
                        fillOpacity={0.5}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Incidents by Domain (Bar)
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={mockDomainData}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="incidents" fill="#60a5fa" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Line Chart + AI + Summary Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Resident Count Trend (Line)
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={mockDomainData}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="residents"
                        stroke="#1e3a8a"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* AI Recommendation Section */}
                  <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-blue-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 1010 10A10 10 0 0012 2z"
                        />
                      </svg>
                      AI-Assisted Recommendation
                    </h3>
                    <p className="text-gray-700 leading-relaxed">
                      Based on recent resident data trends,{" "}
                      <span className="font-semibold">{domainName}</span> shows steady performance.
                      Predicted improvement:{" "}
                      <span className="font-semibold text-green-700">+8%</span> next quarter with
                      continued preventive actions.
                    </p>
                    <p className="text-gray-700 mt-3">
                      Recommendation: Focus on{" "}
                      <span className="font-semibold">data validation</span> and{" "}
                      <span className="font-semibold">staff engagement</span> to sustain improvement.
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Domain Summary Data
                  </h3>
                  <table className="w-full text-sm text-left border border-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-gray-700 font-medium">Domain</th>
                        <th className="px-3 py-2 text-gray-700 font-medium">Score</th>
                        <th className="px-3 py-2 text-gray-700 font-medium">Incidents</th>
                        <th className="px-3 py-2 text-gray-700 font-medium">Residents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockDomainData.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-800">{row.name}</td>
                          <td className="px-3 py-2 text-green-700 font-semibold">
                            {row.score}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{row.incidents}</td>
                          <td className="px-3 py-2 text-gray-700">{row.residents}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
