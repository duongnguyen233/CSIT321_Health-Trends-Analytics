import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import QuestionnaireForm from "./pages/QuestionnaireForm";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import UploadCSVPage from "./pages/UploadCSVPage";
import MyDataPage from "./pages/MyDataPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/questionnaire" element={<QuestionnaireForm />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/upload-csv" element={<UploadCSVPage />} />
        <Route path="/my-data" element={<MyDataPage />} />
      </Routes>
    </Router>
  );
}
