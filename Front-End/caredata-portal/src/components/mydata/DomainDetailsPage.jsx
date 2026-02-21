import { useParams, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#ea580c", "#fbbf24", "#d1d5db"];

export default function DomainDetailsPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const domainName = location.state?.domainName || `Domain ${id}`;
  const completionStatus = location.state?.completion || "Not Started";

  const isCompleted = completionStatus === "Completed";

  const domainData = [
    { month: "Jan", value: 72 },
    { month: "Feb", value: 78 },
    { month: "Mar", value: 85 },
    { month: "Apr", value: 81 },
    { month: "May", value: 89 },
    { month: "Jun", value: 93 },
  ];

  const completionData = [
    { name: "Completed", value: 80 },
    { name: "In Progress", value: 15 },
    { name: "Pending", value: 5 },
  ];

  const incidentData = [
    { category: "Falls", incidents: 12 },
    { category: "Medication", incidents: 9 },
    { category: "Workforce", incidents: 6 },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto gap-6 w-full">
        {/* Sidebar */}
        <MyDataSidebar activePage="My Data" />

        {/* Main Content */}
        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          {/* Header with Back Button */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">
                Domain {id}: {domainName}
              </h1>
              <p className="text-gray-600">
                Completion Status:{" "}
                <span
                  className={`font-semibold ${
                    completionStatus === "Completed"
                      ? "text-green-600"
                      : completionStatus === "In Progress"
                      ? "text-yellow-600"
                      : "text-gray-600"
                  }`}
                >
                  {completionStatus}
                </span>
              </p>
            </div>

            <button
              onClick={() => navigate("/mydata")}
              className="bg-white border border-gray-300 text-gray-700 font-medium px-4 py-2 rounded-md hover:bg-gray-100 transition"
            >
              ← Back to My Data
            </button>
          </div>

          {/* Conditional Render */}
          {!isCompleted ? (
            <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No Data Available
              </h3>
              <p className="text-gray-600 mb-6">
                Data for{" "}
                <span className="font-medium text-orange-600">{domainName}</span>{" "}
                is not available yet. Upload a health record via Health Scan to
                view analytics and charts.
              </p>
              <button
                onClick={() => navigate("/health-scan")}
                className="bg-orange-500 text-white px-6 py-2 rounded-md font-medium hover:bg-orange-600 transition"
              >
                Go to Health Scan
              </button>
            </div>
          ) : (
            <>
              {/* Chart Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                {/* Pie Chart */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Task Completion Breakdown
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={completionData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label
                      >
                        {completionData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Line Chart */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Domain Trend (Line)
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={domainData}>
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#ea580c"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Incident Categories (Bar)
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={incidentData}>
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="incidents" fill="#f97316" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
