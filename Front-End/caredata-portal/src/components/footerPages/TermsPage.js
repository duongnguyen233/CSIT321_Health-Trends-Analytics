import Navbar from "../common/Navbar";
import Footer from "../common/Footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow pt-24 pb-12 px-4 sm:px-6 flex justify-center">
        <div className="bg-white max-w-4xl w-full rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">Terms of Use</h1>

          <p className="text-gray-700 mb-4">
            By accessing or using the CareData Portal, you agree to these Terms of Use.
            This system is provided by <span className="font-semibold">Team W08</span> at the
            University of Wollongong for research and educational purposes.
          </p>

          <h2 className="text-xl font-semibold text-blue-700 mb-2">Purpose</h2>
          <p className="text-gray-700 mb-4">
            The CareData Portal is designed to assist aged care and health research by supporting
            data collection and analysis. It is not intended for direct clinical use or patient treatment.
          </p>

          <h2 className="text-xl font-semibold text-blue-700 mb-2">User Responsibilities</h2>
          <p className="text-gray-700 mb-4">
            Users agree to provide accurate data and not misuse the platform. Any unauthorised access,
            tampering, or misuse of data may lead to restriction or removal.
          </p>

          <h2 className="text-xl font-semibold text-blue-700 mb-2">Intellectual Property</h2>
          <p className="text-gray-700 mb-4">
            All code, design, and visualisations belong to Team W08.
            The data provided by users remains their property but may be used in aggregated, anonymised research results.
          </p>

          <h2 className="text-xl font-semibold text-blue-700 mb-2">Liability Disclaimer</h2>
          <p className="text-gray-700 mb-4">
            The portal is provided “as is” for research purposes.
            The University of Wollongong and Team W08 are not responsible for data interpretation or decision-making based on analytics displayed.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
