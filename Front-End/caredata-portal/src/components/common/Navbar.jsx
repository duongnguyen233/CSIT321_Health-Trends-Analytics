import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Hub } from "aws-amplify/utils";
import { getCurrentUser } from "../../services/api";
import { isCognitoEnabled } from "../../config/amplify";
import { getCognitoIdToken, cognitoSignOut } from "../../services/cognitoAuth";

// Helper to decode JWT token and extract user info (fallback if API fails)
function decodeJWT(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

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
    // Fallback: extract user info from JWT token if API call fails
    const payload = decodeJWT(cognitoToken);
    if (payload) {
      const userData = {
        first_name: payload.given_name || payload.name?.split(" ")[0] || "User",
        last_name: payload.family_name || payload.name?.split(" ").slice(1).join(" ") || "",
        email: payload.email || "",
        sub: payload.sub || "",
      };
      setUser({
        firstName: userData.first_name,
        lastName: userData.last_name,
      });
      localStorage.setItem("user", JSON.stringify(userData));
    }
  }
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

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
      } else if (isCognitoEnabled() && !savedUser) {
        syncUserFromCognitoToken(setUser);
      }
    };

    // Check immediately
    checkUser();

    // Check when location changes (after login redirect)
    const isOAuthCallback = typeof window !== "undefined" && window.location.search.includes("code=");
    if (isOAuthCallback) {
      // For OAuth callbacks, check multiple times with delays
      [300, 800, 1500, 2500].forEach((delay) => {
        setTimeout(() => checkUser(), delay);
      });
    }

    // Listen for auth events
    let unsubscribe;
    if (isCognitoEnabled()) {
      unsubscribe = Hub.listen("auth", ({ payload }) => {
        if (payload.event === "signInWithRedirect" || payload.event === "signedIn") {
          setTimeout(() => checkUser(), 500);
        }
      });
    }

    // Listen for storage changes (e.g., when login happens in another tab or after redirect)
    const handleStorageChange = (e) => {
      if (e.key === "token" || e.key === "user") {
        checkUser();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Also check periodically for a short time after mount (helps with OAuth redirects)
    const intervalId = setInterval(() => {
      const token = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");
      if (token && !savedUser) {
        checkUser();
      }
    }, 500);

    // Clean up after 5 seconds
    setTimeout(() => clearInterval(intervalId), 5000);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(intervalId);
    };
  }, [location.pathname]);

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
        { name: "Health Scan", path: "/health-scan" },
        { name: "My Data", path: "/mydata" },
      ]
    : [
        { name: "Home", path: "/" },
        { name: "Upload Data", path: "/upload-csv" },
        { name: "Health Scan", path: "/health-scan" },
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
                  item.path === "/mydata") ||
                (location.pathname.startsWith("/mydata") &&
                  item.path === "/mydata") ||
                (location.pathname.startsWith("/setting") &&
                  item.path === "/mydata") ||
                (location.pathname.startsWith("/documentation") &&
                  item.path === "/mydata");
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
