import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCurrentUser } from "../../services/api";
import BrandMark from "./BrandMark";

const NAV_ITEMS = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Data Entry", path: "/upload-csv" },
  { name: "Voice Screening", path: "/voice/dashboard" },
  { name: "Reports", path: "/reports" },
  { name: "Benchmarking", path: "/benchmarking" },
];

function MenuIcon({ open }) {
  return (
    <svg
      className="w-6 h-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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

  const navLinkClass = (active, mobile = false) =>
    [
      "text-sm font-medium transition-all rounded-md",
      mobile ? "block w-full px-4 py-3 text-left" : "px-3 py-1.5 whitespace-nowrap",
    ].join(" ");

  const navLinkStyle = (active) =>
    active
      ? { background: "var(--ink-900)", color: "var(--bg-paper)" }
      : { color: "var(--ink-700)" };

  return (
    <nav
      className="fixed top-0 left-0 w-full z-50"
      style={{
        background: "var(--bg-paper)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {/* Top bar: brand + desktop nav OR mobile menu button */}
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 h-16">
        <Link
          to="/"
          className="flex items-center gap-2 min-w-0 hover:opacity-90 transition"
          onClick={() => setIsOpen(false)}
        >
          <BrandMark size={28} className="shrink-0" />
          <span className="flex flex-col leading-none min-w-0">
            <span
              className="text-[15px] font-semibold tracking-tight truncate"
              style={{ color: "var(--ink-900)" }}
            >
              CareData
            </span>
            <span
              className="text-[11px] font-normal mt-[2px] truncate hidden sm:block"
              style={{ color: "var(--ink-500)" }}
            >
              Health Analytics Portal
            </span>
          </span>
        </Link>

        {/* Desktop: centered nav + user */}
        {user ? (
          <div className="hidden lg:flex flex-1 items-center justify-center min-w-0">
            <div className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={navLinkClass(active)}
                    style={navLinkStyle(active)}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = "var(--bg-cream)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <div className="hidden lg:block relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 hover:opacity-80 transition"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: "var(--bg-sage-tint)",
                      color: "var(--sage-ink)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <span className="text-xs font-semibold">{initial}</span>
                  </div>
                  <span
                    className="text-sm font-medium whitespace-nowrap max-w-[120px] truncate"
                    style={{ color: "var(--ink-700)" }}
                  >
                    {user.firstName || "User"}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    style={{ color: "var(--ink-500)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-44 rounded-lg py-1 z-50"
                    style={{
                      background: "var(--bg-white)",
                      border: "1px solid var(--line)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        navigate("/settings");
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-medium transition"
                      style={{ color: "var(--ink-700)" }}
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm font-medium transition"
                      style={{ color: "var(--ink-500)" }}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="lg:hidden p-2 -mr-1 rounded-md"
                style={{ color: "var(--ink-900)" }}
                onClick={() => setIsOpen((v) => !v)}
                aria-label={isOpen ? "Close menu" : "Open menu"}
                aria-expanded={isOpen}
              >
                <MenuIcon open={isOpen} />
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="text-sm font-semibold transition whitespace-nowrap px-2 py-1"
              style={{ color: "var(--ink-900)" }}
            >
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* Mobile menu: full-width panel below header */}
      {user && isOpen && (
        <>
          <button
            type="button"
            className="lg:hidden fixed inset-0 top-16 z-40 bg-black/20"
            aria-label="Close menu"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="lg:hidden relative z-50 border-t px-4 py-4 max-h-[calc(100vh-4rem)] overflow-y-auto"
            style={{
              background: "var(--bg-paper)",
              borderColor: "var(--line)",
            }}
          >
            <nav className="flex flex-col gap-1" aria-label="Main">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={navLinkClass(active, true)}
                    style={navLinkStyle(active)}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div
              className="mt-4 pt-4 flex flex-col gap-1"
              style={{ borderTop: "1px solid var(--line-soft)" }}
            >
              <div className="flex items-center gap-3 px-4 py-2 mb-1">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--bg-sage-tint)",
                    color: "var(--sage-ink)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <span className="text-sm font-semibold">{initial}</span>
                </div>
                <span className="text-sm font-medium truncate" style={{ color: "var(--ink-900)" }}>
                  {user.firstName || "User"} {user.lastName || ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigate("/settings");
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm font-medium rounded-md transition"
                style={{ color: "var(--ink-700)" }}
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  handleLogout();
                }}
                className="w-full text-left px-4 py-3 text-sm font-medium rounded-md transition"
                style={{ color: "var(--ink-500)" }}
              >
                Log out
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
