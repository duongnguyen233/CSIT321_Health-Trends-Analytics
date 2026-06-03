import { useParams, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import MobileSidebarPanel, { PAGE_MAIN_ROW } from "../common/MobileSidebarPanel";
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
import {
  CHART_PALETTE, CHART_GRID, CHART_FONT, axisTickStyle as axisTick,
  tooltipStyle as sharedTooltip,
} from "../../theme/chartTokens";

const PIE_COLORS = [CHART_PALETTE[0], CHART_PALETTE[1], CHART_PALETTE[2]];

// Local alias kept so existing JSX (`contentStyle={tooltipStyle}`) keeps working.
const tooltipStyle = sharedTooltip.contentStyle;

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

  const statusColor =
    completionStatus === "Completed"
      ? "var(--sage-ink)"
      : completionStatus === "In Progress"
      ? "var(--amber)"
      : "var(--ink-500)";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-cream)" }}>
      <Navbar active="My Data" />

      <main className={`${PAGE_MAIN_ROW} max-w-[1280px]`}>
        <MobileSidebarPanel menuLabel="Workspace">
          <MyDataSidebar activePage="My Data" />
        </MobileSidebarPanel>

        <div className="flex-1 min-w-0 w-full cd-surface p-4 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <span className="cd-chip mb-2" style={{ display: "inline-flex" }}>
                <span className="dot" /> Domain {id}
              </span>
              <h1
                className="mb-1"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 30,
                  color: "var(--ink-900)",
                  letterSpacing: "-0.01em",
                }}
              >
                {domainName}
              </h1>
              <p style={{ color: "var(--ink-500)", fontSize: 14 }}>
                Completion status:{" "}
                <span style={{ fontWeight: 600, color: statusColor }}>{completionStatus}</span>
              </p>
            </div>

            <button onClick={() => navigate("/mydata")} className="cd-btn cd-btn-ghost">
              ← Back to My Data
            </button>
          </div>

          {!isCompleted ? (
            <div
              className="text-center py-16"
              style={{
                background: "var(--bg-paper)",
                border: "1px solid var(--line-soft)",
                borderRadius: 12,
              }}
            >
              <h3
                className="mb-2"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 22,
                  color: "var(--ink-900)",
                  letterSpacing: "-0.01em",
                }}
              >
                No data available
              </h3>
              <p className="mb-6" style={{ color: "var(--ink-500)", fontSize: 14 }}>
                Data for{" "}
                <span style={{ fontWeight: 500, color: "var(--ink-900)" }}>{domainName}</span>{" "}
                is not available yet. Upload a health record via Health Scan to view analytics and charts.
              </p>
              <button onClick={() => navigate("/health-scan")} className="cd-btn cd-btn-primary">
                Go to Health Scan
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div
                  className="p-4"
                  style={{
                    background: "var(--bg-paper)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: 12,
                  }}
                >
                  <h3
                    className="mb-3"
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 18,
                      color: "var(--ink-900)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Task completion breakdown
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={completionData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label
                      >
                        {completionData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div
                  className="p-4"
                  style={{
                    background: "var(--bg-paper)",
                    border: "1px solid var(--line-soft)",
                    borderRadius: 12,
                  }}
                >
                  <h3
                    className="mb-3"
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 18,
                      color: "var(--ink-900)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Domain trend
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={domainData}>
                      <XAxis dataKey="month" tick={axisTick} stroke={CHART_GRID} />
                      <YAxis tick={axisTick} stroke={CHART_GRID} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={CHART_PALETTE[0]}
                        strokeWidth={2}
                        dot={{ r: 3, fill: "var(--sage-ink)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div
                className="p-4"
                style={{
                  background: "var(--bg-paper)",
                  border: "1px solid var(--line-soft)",
                  borderRadius: 12,
                }}
              >
                <h3
                  className="mb-3"
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 18,
                    color: "var(--ink-900)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Incident categories
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={incidentData}>
                    <XAxis dataKey="category" tick={axisTick} stroke={CHART_GRID} />
                    <YAxis tick={axisTick} stroke={CHART_GRID} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="incidents" fill={CHART_PALETTE[1]} radius={[8, 8, 0, 0]} />
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
