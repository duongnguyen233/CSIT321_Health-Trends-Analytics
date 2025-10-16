import { ClipboardDocumentListIcon, ArrowUpOnSquareIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";

export default function HowItWorks() {
  const steps = [
    {
      icon: <ClipboardDocumentListIcon className="w-12 h-12 text-blue-600" />,
      title: "Form Filling",
      desc: "Simplify data entry with electronic forms, replacing paper records for greater efficiency."
    },
    {
      icon: <ArrowUpOnSquareIcon className="w-12 h-12 text-blue-600" />,
      title: "Upload CSV",
      desc: "Upload CSV files to quickly transfer data from your existing system, ensuring security and compliance."
    },
    {
      icon: <PaperAirplaneIcon className="w-12 h-12 text-blue-600" />,
      title: "Data Submission",
      desc: "Automatically submit your data to government systems, reducing admin tasks and ensuring timely reporting."
    }
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 text-center">
        {/* Title + Description */}
        <h2 className="text-3xl font-bold mb-6">How It Works</h2>
        <p className="text-gray-600 mb-12">
          Our platform simplifies data reporting for aged care facilities,
          making it quick, secure, and compliant with government standards.
        </p>

        {/* Stepper with icons */}
        <div className="grid md:grid-cols-3 gap-12">
          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center text-center">
              <div className="mb-4">{step.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-gray-600">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
