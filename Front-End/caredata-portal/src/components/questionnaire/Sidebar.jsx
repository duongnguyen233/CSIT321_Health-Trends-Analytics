import React from "react";
import { DOMAINS } from "../common/domains";

export default function Sidebar({ activeDomain, onSelectDomain }) {
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
        {DOMAINS.map((domain, index) => (
          <li
            key={index}
            onClick={() => onSelectDomain(index + 1)}
            className={`
              cursor-pointer rounded-md px-3 py-2
              text-sm md:text-base font-medium
              whitespace-nowrap
              ${
                activeDomain === index + 1
                  ? "bg-gray-800 text-white shadow-md"
                  : "text-gray-700 hover:bg-gray-100"
              }
            `}
          >
            {domain}
          </li>
        ))}
      </ul>
    </aside>
  );
}
