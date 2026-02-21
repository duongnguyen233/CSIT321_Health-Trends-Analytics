import { useNavigate } from "react-router-dom";
import { LayoutGrid, Database, Settings, FileText, GitBranch } from "lucide-react";

export default function MyDataSidebar({ activePage = "Dashboard" }) {
  const navigate = useNavigate();

  return (
    <aside
      className="bg-white border border-gray-200 rounded-xl shadow-sm
                 p-4 overflow-y-auto
                 w-56 md:w-60 lg:w-64
                 max-h-[85vh]"
    >
      {/* Top Section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 mb-3 tracking-wide">
          MENU
        </h2>
        <ul className="space-y-2">
          <li
            onClick={() => navigate("/mydata")}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition
              ${
                activePage === "My Data"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
          >
            <Database size={16} />
            My Data
          </li>

          <li
            onClick={() => navigate("/dashboard")}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition
              ${
                activePage === "Dashboard"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
          >
            <LayoutGrid size={16} />
            Dashboard
          </li>

          <li
            onClick={() => navigate("/careJourneyFlow")}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition
              ${
                activePage === "Care Journey Flow"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
          >
            <GitBranch size={16} />
            Care Journey Flow
          </li>
        </ul>

        <hr className="my-4 border-gray-200" />

        <h2 className="text-sm font-semibold text-gray-600 mb-3 tracking-wide">
          HELP
        </h2>
        <ul className="space-y-2">
          <li
            onClick={() => navigate("/settings")}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition
              ${
                activePage === "Settings"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
          >
            <Settings size={16} />
            Settings
          </li>

          <li
            onClick={() => navigate("/documentation")}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition
              ${
                activePage === "Documentation"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
          >
            <FileText size={16} />
            Documentation
          </li>
        </ul>
      </div>
    </aside>
  );
}
