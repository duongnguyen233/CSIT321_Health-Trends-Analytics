import { useState, useRef, useEffect } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import Sidebar from "../components/questionnaire/Sidebar";
import ProgressBar from "../components/questionnaire/ProgressBar";
import DomainCard from "../components/questionnaire/DomainCard";
import { DOMAIN_DETAILS } from "../components/common/domains";

export default function QuestionnaireForm() {
  const [openDomain, setOpenDomain] = useState(1);
  const domainRefs = useRef({});

  useEffect(() => {
    const section = domainRefs.current[openDomain];
    if (section && openDomain >= 4) {
      const yOffset = -100;
      const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, [openDomain]);

  const handleToggle = (id) => {
    setOpenDomain(openDomain === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24">
      <Navbar />

      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto mt-4 gap-6 px-4 sm:px-6 pb-10">
        <div className="flex-shrink-0">
          <Sidebar activeDomain={openDomain} onSelectDomain={setOpenDomain} />
        </div>

        <main className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h1 className="text-xl sm:text-2xl font-semibold mb-2 text-gray-900">
            Quality Indicator Questionnaire
          </h1>
          <p className="text-gray-600 mb-4 text-sm sm:text-base">
            Complete assessment across all 14 Quality Indicator domains to monitor care standards and outcomes.
          </p>

          <div className="bg-gray-50 p-4 rounded-lg text-gray-700 text-sm border border-gray-200 mb-6">
            Please complete all required fields marked with an asterisk (*). Optional fields do not affect completion.
          </div>

          <ProgressBar completed={0} total={DOMAIN_DETAILS.length} />

          <div className="mt-8 space-y-6">
            {DOMAIN_DETAILS.map((domain) => (
              <div key={domain.id} ref={(el) => (domainRefs.current[domain.id] = el)}>
                <DomainCard
                  id={domain.id}
                  title={domain.title}
                  description={domain.description}
                  open={openDomain === domain.id}
                  onToggle={() => handleToggle(domain.id)}
                  fields={domain.fields}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-10 border-t pt-6">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-100 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Save Draft
            </button>

            <button className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-md hover:bg-orange-600 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4l16 8-16 8V4z" />
              </svg>
              Review & Submit
            </button>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
