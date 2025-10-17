import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { getCurrentUser } from "../../services/api";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      getCurrentUser(token)
        .then((data) => {
          setUser({
            firstName: data.first_name,
            lastName: data.last_name,
          });
          localStorage.setItem("user", JSON.stringify(data));
        })
        .catch(() => {
          const savedUser = localStorage.getItem("user");
          if (savedUser) setUser(JSON.parse(savedUser));
          else {
            localStorage.removeItem("token");
            setUser(null);
          }
        });
    } else {
      const savedUser = localStorage.getItem("user");
      if (savedUser) setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Upload CSV", path: "/upload-csv" },
    { name: "Questionnaire", path: "/questionnaire" },
    { name: "My Data", path: "/dashboard" },
  ];

  return (
    <nav className="bg-dark fixed top-0 left-0 w-full z-50 text-white shadow-lg border-b border-primary/20">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/favicon.ico" alt="CareData Logo" className="w-8 h-8" />
          <span className="text-xl sm:text-2xl font-bold text-primary tracking-tight">
            CareData Portal
          </span>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="sm:hidden text-white focus:outline-none"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? "✕" : "☰"}
        </button>

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center gap-4">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (location.pathname.startsWith("/domain") && item.path === "/dashboard") ||
              (location.pathname.startsWith("/mydata") && item.path === "/dashboard");
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg text-base font-medium transition-all ${
                  isActive
                    ? "bg-primary text-black shadow-md"
                    : "text-gray-300 hover:text-primary hover:bg-grayish"
                }`}
              >
                {item.name}
              </Link>
            );
          })}

          {/* User Auth Area */}
          {user ? (
            <div className="flex items-center gap-3">
              <span className="font-medium text-gray-100">
                Hello, {user ? `${user.firstName} ${user.lastName}` : "User"}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-md bg-primary text-black hover:bg-orange-600 transition"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className={`text-gray-300 font-medium px-4 py-2 rounded-md transition ${
                  location.pathname === "/login"
                    ? "bg-primary text-black"
                    : "hover:text-primary"
                }`}
              >
                Login
              </Link>
              <Link
                to="/register"
                className={`px-4 py-2 rounded-md font-medium shadow-md transition ${
                  location.pathname === "/register"
                    ? "bg-primary text-black"
                    : "bg-orange-600 text-white hover:bg-orange-700"
                }`}
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile Dropdown */}
      {isOpen && (
        <div className="sm:hidden bg-dark border-t border-gray-700 flex flex-col items-start p-4 space-y-2 text-white">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`block w-full text-left px-3 py-2 rounded-md font-medium ${
                  isActive
                    ? "bg-primary text-black"
                    : "text-gray-300 hover:text-primary hover:bg-grayish"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
          <hr className="w-full border-gray-700 my-2" />

          {user ? (
            <>
              <span className="px-3 text-gray-300 font-medium">
                👋 Hello {user.firstName} {user.lastName}
              </span>
              <button
                onClick={() => {
                  handleLogout();
                  setIsOpen(false);
                }}
                className="block w-full text-left px-3 py-2 rounded-md font-medium bg-primary text-black hover:bg-orange-600"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className={`block w-full text-left px-3 py-2 rounded-md font-medium ${
                  location.pathname === "/login"
                    ? "bg-primary text-black"
                    : "text-gray-300 hover:text-primary"
                }`}
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={() => setIsOpen(false)}
                className={`block w-full text-left px-3 py-2 rounded-md font-medium ${
                  location.pathname === "/register"
                    ? "bg-primary text-black"
                    : "bg-orange-600 text-white hover:bg-orange-700"
                }`}
              >
                Register
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
