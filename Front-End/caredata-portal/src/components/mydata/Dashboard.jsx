import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
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

export default function Dashboard() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-24 pb-12 px-4 sm:px-6 max-w-[1280px] mx-auto gap-6">
        <MyDataSidebar activePage="Dashboard" />

        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            National Quality Indicator Dashboard
          </h1>
          <p className="text-gray-600 mb-10">
            Overview of performance, incidents, and resident data across all 14 domains.
          </p>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Overall Domain Performance (Radar)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={mockDomainData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" />
                  <PolarRadiusAxis />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#ea580c"
                    fill="#fb923c"
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
                  <Bar dataKey="incidents" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Line Chart + Summary */}
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
                    stroke="#ea580c"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-orange-800 mb-2">
                  AI-Assisted Recommendation
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  Domain comparison indicates strong improvements in{" "}
                  <span className="font-semibold text-orange-700">Workforce</span> and{" "}
                  <span className="font-semibold text-orange-700">Medication Management</span>.
                  Predicted system-wide improvement:{" "}
                  <span className="font-semibold text-green-700">+11%</span> next quarter.
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
                      <td className="px-3 py-2 text-orange-700 font-semibold">
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
        </div>
      </main>

      <Footer />
    </div>
  );
}
