import Navbar from "../common/Navbar";
import Footer from "../common/Footer";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow pt-24 pb-12 px-4 sm:px-6 flex justify-center">
        <div className="bg-white max-w-4xl w-full rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-gray-700 mb-6">
            CareData Portal is committed to protecting your privacy in accordance with the
            <span className="font-medium"> Australian Privacy Principles </span>
            and the <span className="font-medium"> Privacy Act 1988 (Cth)</span>.
            This system is developed by <span className="font-semibold">Team W08</span>
            at the University of Wollongong for research and educational purposes.
          </p>

          <h2 className="text-xl font-semibold text-orange-400 mb-2">Information We Collect</h2>
          <p className="text-gray-700 mb-4">
            We collect information such as user registration details, uploaded datasets, and responses to
            quality indicator questionnaires to support analysis and reporting.
          </p>

          <h2 className="text-xl font-semibold text-orange-400 mb-2">How We Use Data</h2>
          <p className="text-gray-700 mb-4">
            Collected data is used solely for internal research and analytics to identify trends,
            improve healthcare quality, and ensure compliance with Australian Department of Health standards.
          </p>

          <h2 className="text-xl font-semibold text-orange-400 mb-2">Security</h2>
          <p className="text-gray-700 mb-4">
            All information is securely stored with restricted access. Encryption and secure protocols are
            used to maintain confidentiality and integrity of your data.
          </p>

          <h2 className="text-xl font-semibold text-orange-400 mb-2">Contact</h2>
          <p className="text-gray-700">
            For any privacy concerns, contact us at <span className="font-semibold">caredata@uow.edu.au</span>.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
