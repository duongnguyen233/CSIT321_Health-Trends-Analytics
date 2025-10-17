// src/App.js
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// --- Existing Pages ---
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

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Main routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/questionnaire" element={<QuestionnaireForm />} />
        <Route path="/upload-csv" element={<UploadCSVPage />} />
        <Route path="/mydata" element={<MyDataPage />} />
        <Route path="/domain/:id" element={<DomainDetailsPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<SettingPage />} />
        <Route path="/documentation" element={<DocumentationPage />} />

        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Footer links */}
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
    </Router>
  );
}
