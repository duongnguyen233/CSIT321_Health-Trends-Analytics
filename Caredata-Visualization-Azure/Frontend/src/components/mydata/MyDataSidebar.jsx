import { useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Database,
  Settings,
  FileText,
  History,
  ShieldCheck,
} from "../../icons/lucideBundle";

const SECTIONS = [
  {
    heading: "Workspace",
    items: [
      { label: "My Data", icon: Database, key: "My Data", to: "/mydata" },
      { label: "Personal dashboard", icon: LayoutGrid, key: "Dashboard", to: "/health-dashboard" },
      { label: "Uploaded history", icon: History, key: "Uploaded History", to: "/uploaded-history" },
    ],
  },
  {
    heading: "Support",
    items: [
      { label: "Settings", icon: Settings, key: "Settings", to: "/settings" },
      { label: "Documentation", icon: FileText, key: "Documentation", to: "/documentation" },
    ],
  },
];

export default function MyDataSidebar({ activePage = "Dashboard" }) {
  const navigate = useNavigate();

  return (
    <aside
      className="shrink-0 self-start w-full lg:w-60 static lg:sticky lg:top-24"
      style={{
        background: "var(--bg-white)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: "18px 14px",
      }}
    >
      {SECTIONS.map((section, sIdx) => (
        <div key={section.heading}>
          {sIdx > 0 && (
            <div
              style={{
                height: 1,
                background: "var(--line-soft)",
                margin: "14px 4px",
              }}
            />
          )}
          <div
            className="uppercase"
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--ink-500)",
              padding: "8px 12px 6px",
            }}
          >
            {section.heading}
          </div>
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.key;
            return (
              <div
                key={item.key}
                onClick={() => navigate(item.to)}
                className="cursor-pointer flex items-center gap-2.5 transition"
                style={{
                  padding: "9px 12px",
                  fontSize: 14,
                  borderRadius: 10,
                  color: active ? "var(--ink-900)" : "var(--ink-700)",
                  background: active ? "var(--bg-sage-tint)" : "transparent",
                  fontWeight: active ? 500 : 400,
                  boxShadow: active ? "inset 0 0 0 1px var(--sage)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "var(--bg-cream)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <Icon
                  size={16}
                  style={{ color: active ? "var(--sage-ink)" : "var(--ink-500)" }}
                />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      ))}

      {/* Compliance card */}
      <div
        className="mt-5"
        style={{
          padding: 14,
          borderRadius: 12,
          background: "var(--bg-sage-tint)",
          border: "1px solid var(--line-soft)",
        }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <ShieldCheck size={14} style={{ color: "var(--sage-ink)" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--ink-900)" }}>
            FHIR-aligned
          </span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--ink-500)" }}>
          Data handled per Australian Digital Health Agency standards.
        </p>
      </div>
    </aside>
  );
}
