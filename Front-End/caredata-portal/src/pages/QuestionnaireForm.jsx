import { useState, useRef, useEffect } from "react";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import Sidebar from "../components/questionnaire/Sidebar";
import ProgressBar from "../components/questionnaire/ProgressBar";
import DomainCard from "../components/questionnaire/DomainCard";

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

  // --- Domains configuration ---
  const domains = [
    {
      id: 1,
      title: "Domain 1: Pressure Injuries",
      description: "Assessment of pressure injury incidents and prevention measures",
      fields: [
        { label: "Number of residents with new or worsened pressure injuries", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Total number of residents", type: "number", required: true },
        { label: "Describe current pressure injury prevention measures", type: "textarea", required: false },
      ],
    },
    {
      id: 2,
      title: "Domain 2: Restrictive Practices",
      description: "Monitoring of restrictive practice usage and alternatives",
      fields: [
        { label: "Number of restrictive practice incidents", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Number of physical restraint uses", type: "number", required: true },
        { label: "Number of chemical restraint uses", type: "number", required: true },
        { label: "Describe alternative strategies being used", type: "textarea", required: false },
      ],
    },
    {
      id: 3,
      title: "Domain 3: Unplanned Weight Loss – Significant",
      description: "Tracking significant unplanned weight loss (≥5% in 30 days or ≥10% in 180 days)",
      fields: [
        { label: "Number of residents with significant unplanned weight loss", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Weight monitoring frequency (days)", type: "number", required: true },
        { label: "Describe nutritional interventions in place", type: "textarea", required: false },
      ],
    },
    {
      id: 4,
      title: "Domain 4: Unplanned Weight Loss – Consecutive",
      description: "Tracking consecutive unplanned weight loss over multiple periods",
      fields: [
        { label: "Number of residents with consecutive weight loss", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Number of consecutive periods tracked", type: "number", required: true },
        { label: "Assessment of intervention effectiveness", type: "textarea", required: false },
      ],
    },
    {
      id: 5,
      title: "Domain 5: Falls and Major Injury",
      description: "Monitoring falls incidents and resulting major injuries",
      fields: [
        { label: "Total number of falls", type: "number", required: true },
        { label: "Number of falls resulting in major injury", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Describe fall prevention program", type: "textarea", required: false },
      ],
    },
    {
      id: 6,
      title: "Domain 6: Medication – Polypharmacy",
      description: "Assessment of residents receiving multiple medications",
      fields: [
        { label: "Number of residents with polypharmacy (≥9 medications)", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Medication review frequency (days)", type: "number", required: true },
        { label: "Describe deprescribing initiatives", type: "textarea", required: false },
      ],
    },
    {
      id: 7,
      title: "Domain 7: Medication – Antipsychotics",
      description: "Monitoring antipsychotic medication usage",
      fields: [
        { label: "Number of residents receiving antipsychotics", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Number receiving behavioral interventions first", type: "number", required: true },
        { label: "Describe gradual dose reduction attempts", type: "textarea", required: false },
      ],
    },
    {
      id: 8,
      title: "Domain 8: Activities of Daily Living (ADLs)",
      description: "Assessment of ADL performance and support needs",
      fields: [
        { label: "Number of residents with ADL decline", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Number receiving rehabilitation services", type: "number", required: true },
        { label: "Describe ADL support strategies", type: "textarea", required: false },
      ],
    },
    {
      id: 9,
      title: "Domain 9: Incontinence Care (IAD)",
      description: "Management of incontinence-associated dermatitis",
      fields: [
        { label: "Number of residents with incontinence-associated dermatitis", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Number in continence management program", type: "number", required: true },
        { label: "Describe skin care protocols", type: "textarea", required: false },
      ],
    },
    {
      id: 10,
      title: "Domain 10: Hospitalisation",
      description: "Tracking hospitalization rates and causes",
      fields: [
        { label: "Number of hospitalizations", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Number of potentially preventable hospitalizations", type: "number", required: true },
        { label: "Describe hospitalization reduction strategies", type: "textarea", required: false },
      ],
    },
    {
      id: 11,
      title: "Domain 11: Workforce",
      description: "Staff turnover and workforce stability measures",
      fields: [
        { label: "Staff turnover rate (%)", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Number of staff retention initiatives", type: "number", required: true },
        { label: "Describe workforce development programs", type: "textarea", required: false },
      ],
    },
    {
      id: 12,
      title: "Domain 12: Consumer Experience (QCE-ACC)",
      description: "Consumer experience assessment scores",
      fields: [
        { label: "Overall consumer satisfaction score (0-100)", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Survey response rate (%)", type: "number", required: true },
        { label: "Describe actions taken based on consumer feedback", type: "textarea", required: false },
      ],
    },
    {
      id: 13,
      title: "Domain 13: Quality of Life (QOL-ACC)",
      description: "Quality of life assessment and measures",
      fields: [
        { label: "Overall quality of life score (0-100)", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Number of lifestyle and wellness programs", type: "number", required: true },
        { label: "Describe quality of life improvement initiatives", type: "textarea", required: false },
      ],
    },
    {
      id: 14,
      title: "Domain 14: Allied Health Interventions",
      description: "Tracking allied health service usage and outcomes",
      fields: [
        { label: "Number of allied health interventions", type: "number", required: true },
        { label: "Assessment period end date", type: "date", required: true },
        { label: "Overall quality of allied health services", type: "number", required: true },
        { label: "Describe allied health impact", type: "textarea", required: false },
      ],
    },
  ];

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

          <ProgressBar completed={0} total={14} />

          <div className="mt-8 space-y-6">
            {domains.map((domain) => (
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

            <button className="flex items-center gap-2 px-5 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition">
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
