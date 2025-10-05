import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Questionnaire Form", path: "/questionnaire" },
    { name: "About", path: "/about" },
    { name: "Contact", path: "/contact" },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/favicon.ico"
            alt="CareData Logo"
            className="w-9 h-9"
          />
          <span className="text-2xl font-bold text-gray-800 tracking-tight">
            CareData Portal
          </span>
        </div>

        {/* Center: Navigation Links */}
        <div className="flex items-center gap-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-5 py-2 rounded-lg text-base font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-blue-50 text-blue-700 shadow-md"
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Right: Auth Buttons */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-gray-700 hover:text-blue-600 font-medium transition-all"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow-md hover:bg-blue-700 transition-all"
          >
            Register
          </Link>
        </div>
      </div>
    </nav>
  );
}
