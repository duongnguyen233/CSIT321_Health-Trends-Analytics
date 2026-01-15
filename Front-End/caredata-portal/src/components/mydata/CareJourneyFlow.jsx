import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";
import { GitBranch, User, CalendarDays, Activity, Info } from "lucide-react";

const STAGES = [
  { key: "admission", label: "Admission" },
  { key: "assessment", label: "Assessment" },
  { key: "treatment", label: "Treatment" },
  { key: "review", label: "Review" },
  { key: "discharge", label: "Discharge" },
];

// Mock data (replace later with CSV)
const MOCK_PATIENTS = [
  {
    id: "P-1024",
    name: "Patient 1024",
    risk: "Medium",
    timeline: {
      admission: { date: "2026-01-02", days: 1 },
      assessment: { date: "2026-01-03", days: 2 },
      treatment: { date: "2026-01-05", days: 4 },
      review: { date: "2026-01-09", days: 1 },
      discharge: { date: "2026-01-10", days: 0 },
    },
  },
  {
    id: "P-2049",
    name: "Patient 2049",
    risk: "High",
    timeline: {
      admission: { date: "2026-01-06", days: 2 },
      assessment: { date: "2026-01-08", days: 3 },
      treatment: { date: "2026-01-11", days: 6 },
      review: { date: "2026-01-17", days: 2 },
      discharge: { date: "2026-01-19", days: 0 },
    },
  },
];

function formatDate(d) {
  return d || "-";
}

function sumDays(timeline) {
  return Object.values(timeline || {}).reduce((acc, v) => acc + (v?.days ?? 0), 0);
}

function riskClass(risk) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border";
  if (risk === "High") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (risk === "Medium") return `${base} border-yellow-200 bg-yellow-50 text-yellow-700`;
  return `${base} border-green-200 bg-green-50 text-green-700`;
}

export default function CareJourneyFlow() {
  const navigate = useNavigate();

  const [patientId, setPatientId] = useState(MOCK_PATIENTS[0]?.id);
  const [activeStageKey, setActiveStageKey] = useState("treatment");

  const patient = useMemo(
    () => MOCK_PATIENTS.find((p) => p.id === patientId) ?? MOCK_PATIENTS[0],
    [patientId]
  );

  const activeStage = useMemo(() => {
    const s = STAGES.find((x) => x.key === activeStageKey) ?? STAGES[0];
    const meta = patient?.timeline?.[s.key];
    return { ...s, meta };
  }, [activeStageKey, patient]);

  const totalDays = useMemo(() => sumDays(patient?.timeline), [patient]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 max-w-7xl mx-auto gap-6">
        {/* Sidebar */}
        <MyDataSidebar activePage="Care Journey Flow" />

        {/* Main Content */}
        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          {/* Header with Back Button */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GitBranch size={18} className="text-orange-600" />
                <h1 className="text-2xl font-semibold text-gray-900">
                  Care Journey Flow
                </h1>
              </div>
              <p className="text-gray-600">
                Visualise patient journey stages with an animated pathway.
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <User size={16} className="text-gray-500" />
                <select
                  value={patientId}
                  onChange={(e) => {
                    setPatientId(e.target.value);
                    setActiveStageKey("treatment");
                  }}
                  className="text-sm outline-none bg-transparent text-gray-800"
                >
                  {MOCK_PATIENTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} — {p.risk} Risk
                    </option>
                  ))}
                </select>
              </div>

              <span className={riskClass(patient?.risk)}>{patient?.risk} Risk</span>
            </div>

            <div className="text-sm text-gray-500">
              Tip: click a stage to see details
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <KpiCard
              title="Total Journey Days"
              value={totalDays}
              icon={<Activity size={16} className="text-gray-400" />}
              hint="Sum of stage durations"
            />
            <KpiCard
              title="Current Highlight"
              value={activeStage.label}
              icon={<Info size={16} className="text-gray-400" />}
              hint="Selected stage"
            />
            <KpiCard
              title="Stage Date"
              value={formatDate(activeStage.meta?.date)}
              icon={<CalendarDays size={16} className="text-gray-400" />}
              hint={`Duration: ${activeStage.meta?.days ?? 0} day(s)`}
            />
          </div>

          {/* Diagram */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">
                Patient Journey (Animated Flow)
              </h3>
              <div className="text-xs text-gray-500">
                Node value = duration (days)
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <FlowDiagram
                  stages={STAGES}
                  timeline={patient?.timeline}
                  activeStageKey={activeStageKey}
                  onSelectStage={setActiveStageKey}
                />
              </div>
            </div>
          </div>

          {/* Details + Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Stage Details
              </h3>
              <div className="space-y-2 text-sm text-gray-700">
                <Row label="Stage" value={activeStage.label} />
                <Row label="Date" value={formatDate(activeStage.meta?.date)} />
                <Row
                  label="Duration"
                  value={`${activeStage.meta?.days ?? 0} day(s)`}
                />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Connect to CSV (simple mapping)
              </h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                <li>
                  Map <span className="font-mono text-xs">patient_id</span> → patient selector
                </li>
                <li>
                  Map <span className="font-mono text-xs">stage</span> → Admission/Assessment/Treatment/Review/Discharge
                </li>
                <li>
                  Use <span className="font-mono text-xs">date</span> and{" "}
                  <span className="font-mono text-xs">duration_days</span>
                </li>
                <li>
                  Total journey days = sum of all stage durations
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function KpiCard({ title, value, icon, hint }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function FlowDiagram({ stages, timeline, activeStageKey, onSelectStage }) {
  const W = 760;
  const H = 170;
  const nodeR = 20;

  const positions = stages.map((s, i) => {
    const x = 90 + i * 150;
    const y = 70;
    return { ...s, x, y };
  });

  const activeIndex = stages.findIndex((x) => x.key === activeStageKey);

  return (
    <div className="relative">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        <defs>
          <style>
            {`
              .flow-line {
                stroke-dasharray: 6 6;
                animation: dash 2.2s linear infinite;
              }
              @keyframes dash {
                to { stroke-dashoffset: -24; }
              }
              .pulse {
                transform-origin: center;
                animation: pulse 1.6s ease-in-out infinite;
              }
              @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.08); }
              }
            `}
          </style>
        </defs>

        {/* connectors */}
        {positions.slice(0, -1).map((p, idx) => {
          const n = positions[idx + 1];
          const isActivePath = activeIndex >= idx + 1;

          return (
            <g key={`${p.key}-${n.key}`}>
              <line
                x1={p.x + nodeR}
                y1={p.y}
                x2={n.x - nodeR}
                y2={n.y}
                stroke={isActivePath ? "#f97316" : "#d1d5db"}
                strokeWidth="3"
                className="flow-line"
              />
              <polygon
                points={`${n.x - nodeR},${n.y} ${n.x - nodeR - 10},${n.y - 6} ${
                  n.x - nodeR - 10
                },${n.y + 6}`}
                fill={isActivePath ? "#f97316" : "#d1d5db"}
              />
            </g>
          );
        })}

        {/* nodes */}
        {positions.map((p) => {
          const isActive = p.key === activeStageKey;
          const meta = timeline?.[p.key];

          return (
            <g
              key={p.key}
              className="cursor-pointer"
              onClick={() => onSelectStage(p.key)}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={nodeR + 10}
                fill={isActive ? "rgba(249,115,22,0.15)" : "rgba(156,163,175,0.10)"}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={nodeR}
                fill={isActive ? "#f97316" : "#ffffff"}
                stroke={isActive ? "#f97316" : "#d1d5db"}
                strokeWidth="2"
                className={isActive ? "pulse" : ""}
              />
              <text
                x={p.x}
                y={p.y + 5}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={isActive ? "#ffffff" : "#374151"}
              >
                {String(meta?.days ?? 0)}
              </text>

              <text
                x={p.x}
                y={p.y + 45}
                textAnchor="middle"
                fontSize="12"
                fill={isActive ? "#111827" : "#374151"}
                fontWeight={isActive ? "700" : "600"}
              >
                {p.label}
              </text>

              <text
                x={p.x}
                y={p.y + 62}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
              >
                {meta?.date ?? "-"}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
        <span>Orange line shows progress up to selected stage</span>
        <span>Click nodes to inspect</span>
      </div>
    </div>
  );
}
