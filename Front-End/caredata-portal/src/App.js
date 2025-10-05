import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import QuestionnaireForm from "./pages/QuestionnaireForm";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/questionnaire" element={<QuestionnaireForm />} />
      </Routes>
    </BrowserRouter>
  );
}
