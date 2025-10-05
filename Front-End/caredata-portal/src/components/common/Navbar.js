import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // ✅ Updated paths
  const navItems = [
    { name: "Home", path: "/" },
    { name: "Upload CSV", path: "/upload-csv" },
    { name: "Questionnaire Form", path: "/questionnaire" },
    { name: "My Data", path: "/my-data" },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 w-full z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/favicon.ico" alt="CareData Logo" className="w-8 h-8" />
          <span className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">
            CareData Portal
          </span>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="sm:hidden text-gray-700 focus:outline-none"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? "✕" : "☰"}
        </button>

        {/* Desktop Nav */}
        <div className="hidden sm:flex items-center gap-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg text-base font-medium transition-all ${
                  isActive
                    ? "bg-blue-50 text-blue-700 shadow-md"
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                }`}
              >
                {item.name}
              </Link>
            );
          })}

          {/* Login / Register Buttons */}
          <Link
            to="/login"
            className={`text-gray-700 font-medium px-4 py-2 rounded-md transition ${
              location.pathname === "/login"
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "hover:text-blue-600"
            }`}
          >
            Login
          </Link>
          <Link
            to="/register"
            className={`px-4 py-2 rounded-md font-medium shadow-md transition ${
              location.pathname === "/register"
                ? "bg-blue-700 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            Register
          </Link>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {isOpen && (
        <div className="sm:hidden bg-white border-t border-gray-200 shadow-md flex flex-col items-start p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`block w-full text-left px-3 py-2 rounded-md font-medium ${
                  isActive
                    ? "bg-blue-50 text-blue-700 shadow-sm"
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
          <hr className="w-full border-gray-200 my-2" />
          <Link
            to="/login"
            onClick={() => setIsOpen(false)}
            className={`block w-full text-left px-3 py-2 rounded-md font-medium ${
              location.pathname === "/login"
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-gray-700 hover:text-blue-600"
            }`}
          >
            Login
          </Link>
          <Link
            to="/register"
            onClick={() => setIsOpen(false)}
            className={`block w-full text-left px-3 py-2 rounded-md font-medium ${
              location.pathname === "/register"
                ? "bg-blue-700 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            Register
          </Link>
        </div>
      )}
    </nav>
  );
}
