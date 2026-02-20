import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Hub } from "aws-amplify/utils";
import { getCurrentUser } from "../../services/api";
import { isCognitoEnabled } from "../../config/amplify";
import { getCognitoIdToken, cognitoSignOut } from "../../services/cognitoAuth";

async function syncUserFromCognitoToken(setUser) {
  const cognitoToken = await getCognitoIdToken();
  if (!cognitoToken) return;
  localStorage.setItem("token", cognitoToken);
  try {
    const data = await getCurrentUser(cognitoToken);
    setUser({
      firstName: data.first_name || "",
      lastName: data.last_name || "",
    });
    localStorage.setItem("user", JSON.stringify(data));
  } catch (e) {
    // Silent fail - user will need to sign in again
  }
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser({
          firstName: parsedUser.first_name || parsedUser.firstName || "",
          lastName: parsedUser.last_name || parsedUser.lastName || "",
        });
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
    }
    if (isCognitoEnabled() && !savedUser) {
      const isOAuthCallback = typeof window !== "undefined" && window.location.search.includes("code=");
      syncUserFromCognitoToken(setUser);
      if (isOAuthCallback) {
        [300, 800, 1500].forEach((delay) => {
          setTimeout(() => syncUserFromCognitoToken(setUser), delay);
        });
      }
      const unsubscribe = Hub.listen("auth", ({ payload }) => {
        if (payload.event === "signInWithRedirect" || payload.event === "signedIn") {
          syncUserFromCognitoToken(setUser);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  const handleLogout = async () => {
    // Clear local state first to prevent any redirects from affecting the UI
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    
    // Then try to sign out from Cognito (this might trigger OAuth redirect, but we've already cleared state)
    if (isCognitoEnabled()) {
      try {
        // Use a timeout to prevent hanging if redirect happens
        await Promise.race([
          cognitoSignOut(),
          new Promise((resolve) => setTimeout(resolve, 1000)), // Max 1 second wait
        ]);
      } catch (e) {
        // Ignore OAuth redirect errors - state is already cleared
      }
    }
    
    navigate("/");
  };

  // ✅ Show "My Data" only when logged in
  const navItems = user
    ? [
        { name: "Home", path: "/" },
        { name: "Upload Data", path: "/upload-csv" },
        { name: "Questionnaire", path: "/questionnaire" },
        { name: "My Data", path: "/dashboard" },
      ]
    : [
        { name: "Home", path: "/" },
        { name: "Upload Data", path: "/upload-csv" },
        { name: "Questionnaire", path: "/questionnaire" },
      ];

  return (
    <nav className="bg-dark fixed top-0 left-0 w-full z-50 text-white">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1">
          <img src="/favicon.ico" alt="CareData Logo" className="w-10 h-10" />
          <span className="text-lg sm:text-lg font-bold text-white leading-none">
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
        <div className="hidden sm:flex items-center justify-between w-full max-w-[800px] ml-10">
          {/* Left Nav Buttons */}
          <div className="flex items-center gap-4">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (location.pathname.startsWith("/domain") &&
                  item.path === "/dashboard") ||
                (location.pathname.startsWith("/mydata") &&
                  item.path === "/dashboard") ||
                (location.pathname.startsWith("/setting") &&
                  item.path === "/dashboard") ||
                (location.pathname.startsWith("/documentation") &&
                  item.path === "/dashboard");
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
          </div>

          {/* Right Auth Section */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="font-medium text-gray-100">
                  Hello, {user.firstName || "User"}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-5 py-2.5 min-w-[120px] rounded-md bg-primary text-black hover:bg-orange-600 transition font-medium shadow-md"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className={`px-6 py-2.5 min-w-[140px] text-center rounded-md font-semibold transition shadow-md ${
                  location.pathname === "/login" ||
                  location.pathname === "/register"
                    ? "bg-orange-600 text-black"
                    : "bg-primary text-white hover:bg-orange-700"
                }`}
              >
                Sign In
              </Link>
            )}
          </div>
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
            <Link
              to="/login"
              onClick={() => setIsOpen(false)}
              className={`block w-full text-left px-3 py-2 rounded-md font-medium text-center ${
                location.pathname === "/login" ||
                location.pathname === "/register"
                  ? "bg-primary text-black"
                  : "bg-orange-600 text-white hover:bg-orange-700"
              }`}
            >
              Login
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
