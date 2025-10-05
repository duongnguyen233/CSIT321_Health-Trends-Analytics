export default function Sidebar({ activeDomain, onSelectDomain }) {
  const domains = [
    "Domain 1: Pressure Injuries",
    "Domain 2: Restrictive Practices",
    "Domain 3: Unplanned Weight Loss – Significant",
    "Domain 4: Unplanned Weight Loss – Consecutive",
    "Domain 5: Falls and Major Injury",
    "Domain 6: Medication – Polypharmacy",
    "Domain 7: Medication – Antipsychotics",
    "Domain 8: Activities of Daily Living (ADLs)",
    "Domain 9: Incontinence Care (IAD)",
    "Domain 10: Hospitalisation",
    "Domain 11: Workforce",
    "Domain 12: Consumer Experience (QCE-ACC)",
    "Domain 13: Quality of Life (QOL-ACC)",
  ];

  return (
    <aside
      className="
        bg-white border border-gray-200 rounded-xl shadow-sm
        p-4 overflow-y-auto
        min-w-[240px] sm:min-w-[260px] md:min-w-[280px] lg:min-w-[320px] xl:min-w-[360px]
        max-w-full
        max-h-[85vh]
      "
    >
      <h2 className="text-lg font-semibold mb-4 text-gray-800 whitespace-nowrap">
        Quality Indicator Domains
      </h2>
      <ul className="space-y-1">
        {domains.map((domain, index) => (
          <li
            key={index}
            onClick={() => onSelectDomain(index + 1)}
            className={`
              cursor-pointer rounded-md px-3 py-2
              text-sm md:text-base font-medium
              whitespace-nowrap
              ${activeDomain === index + 1
                ? "bg-gray-800 text-white shadow-md"
                : "text-gray-700 hover:bg-gray-100"}
            `}
          >
            {domain}
          </li>
        ))}
      </ul>
    </aside>
  );
}
