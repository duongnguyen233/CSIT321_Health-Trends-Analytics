import React from "react";

export default function Sidebar({ activeDomain, onSelectDomain }) {
  const domains = [
    { id: 1, title: "Pressure Injuries" },
    { id: 2, title: "Restrictive Practices" },
    { id: 3, title: "Unplanned Weight Loss – Significant" },
    { id: 4, title: "Unplanned Weight Loss – Consecutive" },
    { id: 5, title: "Falls and Major Injury" },
    { id: 6, title: "Medication – Polypharmacy" },
    { id: 7, title: "Medication – Antipsychotics" },
    { id: 8, title: "Activities of Daily Living (ADLs)" },
    { id: 9, title: "Incontinence Care (IAD)" },
    { id: 10, title: "Hospitalisation" },
    { id: 11, title: "Workforce" },
    { id: 12, title: "Consumer Experience (QCE-ACC)" },
    { id: 13, title: "Quality of Life (QOL-ACC)" },
  ];

  return (
    <aside className="sticky top-24 self-start bg-white rounded-xl shadow-md border border-gray-200 px-6 py-6 w-fit">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Domains</h2>

      <nav className="flex flex-col space-y-3">
        {domains.map((domain) => (
          <button
            key={domain.id}
            onClick={() => onSelectDomain(domain.id)}
            className={`text-left px-4 py-3 rounded-lg transition-all duration-200 whitespace-nowrap truncate ${
              activeDomain === domain.id
                ? "bg-gray-800 text-white shadow-md scale-[1.02]"
                : "text-gray-800 hover:bg-gray-100"
            }`}
          >
            <span className="text-base font-semibold">
              Domain {domain.id}: {domain.title}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
