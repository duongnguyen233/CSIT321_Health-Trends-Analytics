// src/App.js
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Existing Pages
import LandingPage from "./pages/LandingPage";
import QuestionnaireForm from "./pages/QuestionnaireForm";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import UploadCSVPage from "./pages/UploadCSVPage";
import MyDataPage from "./pages/MyDataPage";
import DomainDetailsPage from "./components/mydata/DomainDetailsPage";
import SettingPage from "./components/mydata/SettingPage";
import DocumentationPage from "./components/mydata/DocumentationPage";
import Dashboard from "./components/mydata/Dashboard";
import PrivacyPage from "./components/footerPages/PrivacyPage";
import TermsPage from "./components/footerPages/TermsPage";
import ContactPage from "./components/footerPages/ContactPage";
import ScrollToTop from "./components/common/ScrollToTop";
import AboutPage from "./components/footerPages/AboutUs";
import SetupAccountPage from "./pages/SetupAccountPage";

import { useContext } from "react";
import { AuthContext } from "./context/AuthContext";

// ------------------- 🔐 Route Protection -------------------
function RequireAuth({ children }) {
  const { user } = useContext(AuthContext);
  const isLoggedIn = !!localStorage.getItem("token");

  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}
// ------------------------------------------------------------

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/about" element={<AboutPage />} />

        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/setup-account" element={<SetupAccountPage />} />

        {/* Protected Routes */}
        <Route
          path="/questionnaire"
          element={
            <RequireAuth>
              <QuestionnaireForm />
            </RequireAuth>
          }
        />

        <Route
          path="/upload-csv"
          element={
            <RequireAuth>
              <UploadCSVPage />
            </RequireAuth>
          }
        />

        <Route
          path="/mydata"
          element={
            <RequireAuth>
              <MyDataPage />
            </RequireAuth>
          }
        />

        <Route
          path="/domain/:id"
          element={
            <RequireAuth>
              <DomainDetailsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />

        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingPage />
            </RequireAuth>
          }
        />

        <Route
          path="/documentation"
          element={
            <RequireAuth>
              <DocumentationPage />
            </RequireAuth>
          }
        />

        {/* Example Admin-Only Route (optional) */}
        {/*
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        */}
      </Routes>
    </Router>
  );
}
