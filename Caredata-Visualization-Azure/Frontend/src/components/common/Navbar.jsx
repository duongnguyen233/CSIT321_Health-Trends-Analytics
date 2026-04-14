import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCurrentUser } from "../../services/api";

const NAV_ITEMS = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Data Entry", path: "/upload-csv" },
  { name: "Voice Screening", path: "/voice/dashboard" },
  { name: "Reports", path: "/reports" },
  { name: "Benchmarking", path: "/benchmarking" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);

  useEffect(() => {
    const checkUser = () => {
      const token = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");

      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser({
            firstName: parsedUser.first_name || parsedUser.firstName || "",
            lastName: parsedUser.last_name || parsedUser.lastName || "",
          });
          return;
        } catch {
          localStorage.removeItem("user");
        }
      }

      if (token && !savedUser) {
        getCurrentUser(token)
          .then((data) => {
            setUser({ firstName: data.first_name, lastName: data.last_name });
            localStorage.setItem("user", JSON.stringify(data));
          })
          .catch(() => {
            localStorage.removeItem("token");
            setUser(null);
          });
      } else {
        setUser(null);
      }
    };

    checkUser();
    window.addEventListener("storage", (e) => {
      if (e.key === "token" || e.key === "user") checkUser();
    });
    return () => window.removeEventListener("storage", checkUser);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/";
  };

  // Close user menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setUserMenuOpen(false);
    setIsOpen(false);
  }, [location.pathname]);

  const isActive = (path) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    if (path === "/upload-csv") return location.pathname.startsWith("/upload-csv");
    if (path === "/reports") return location.pathname.startsWith("/reports");
    if (path === "/benchmarking") return location.pathname.startsWith("/benchmarking");
    if (path === "/settings") return location.pathname.startsWith("/settings");
    if (path === "/voice/dashboard") return location.pathname.startsWith("/voice/dashboard");
    return location.pathname === path;
  };

  const initial = user?.firstName?.charAt(0)?.toUpperCase() || "U";

  return (
    <nav className="bg-dark fixed top-0 left-0 w-full z-50 text-white">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16 relative">

        {/* Left — Logo inline */}
        <Link to="/" className="flex items-center gap-2 shrink-0 hover:opacity-90 transition">
          <img src="/favicon.ico" alt="CareData" className="w-7 h-7" />
          <span className="text-sm font-semibold text-white whitespace-nowrap">CareData</span>
        </Link>

        {/* Mobile hamburger */}
        {user && (
          <button
            type="button"
            className="sm:hidden text-white focus:outline-none p-2 shrink-0"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Menu"
          >
            {isOpen ? "✕" : "☰"}
          </button>
        )}

        {/* Center + Right */}
        <div className={`${user ? (isOpen ? "flex" : "hidden") : "flex"} sm:flex flex-col sm:flex-row sm:items-center sm:ml-auto gap-4 sm:gap-0`}>

          {user ? (
            <>
              {/* Center — Nav links (absolutely centered on viewport) */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1
                sm:absolute sm:left-1/2 sm:-translate-x-1/2">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`px-3 py-1.5 text-sm font-medium transition-all whitespace-nowrap ${
                      isActive(item.path)
                        ? "text-white border-b-2 border-primary"
                        : "text-white/50 hover:text-white border-b-2 border-transparent hover:border-primary/60"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>

              {/* Right — User dropdown */}
              <div className="relative shrink-0" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 hover:opacity-80 transition"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-semibold text-primary">{initial}</span>
                  </div>
                  <span className="text-sm font-medium text-white/70 whitespace-nowrap">{user.firstName || "User"}</span>
                  <svg className={`w-3.5 h-3.5 text-white/40 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-dark border border-white/10 rounded-md shadow-lg py-1 z-50">
                    <button
                      onClick={() => { navigate("/settings"); setUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition"
                    >
                      Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-white/40 hover:text-white hover:bg-white/5 transition"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="sm:flex-1 flex sm:justify-end">
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="text-sm font-semibold text-primary hover:text-primary-hover transition whitespace-nowrap"
              >
                Sign In
              </Link>
            </div>
          )}

        </div>
      </div>
    </nav>
  );
}
