import Navbar from "../common/Navbar";
import Footer from "../common/Footer";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow pb-12 px-4 sm:px-6 flex justify-center pt-32">
        <div className="bg-white max-w-4xl w-full rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">About Us</h1>
          <p className="text-gray-600 mb-6">UOW Capstone Project — Spring 2025</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-orange-500 mb-2">Our Purpose</h2>
            <p className="text-gray-700">
              We’re building a Business-to-Government (B2G) SaaS platform—<span className="font-semibold">CareData Portal</span>—to help aged care providers manage Quality Indicator data with less friction.
              Our goals: streamline CSV ingestion, validate datasets, map fields to the required domain, and support secure reporting workflows for compliance and analytics.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-orange-500 mb-3">The Team (W08)</h2>
            <ul className="grid sm:grid-cols-2 gap-4">
              <li className="p-4 border border-gray-200 rounded-xl">
                <p className="font-semibold text-gray-900">Nelly Nguyen</p>
                <p className="text-gray-600">Technical Leader</p>
              </li>
              <li className="p-4 border border-gray-200 rounded-xl">
                <p className="font-semibold text-gray-900">Duong Nguyen</p>
                <p className="text-gray-600">Project Manager</p>
              </li>
              <li className="p-4 border border-gray-200 rounded-xl">
                <p className="font-semibold text-gray-900">Minh Binh</p>
                <p className="text-gray-600">Software Engineer</p>
              </li>
              <li className="p-4 border border-gray-200 rounded-xl">
                <p className="font-semibold text-gray-900">Wayne</p>
                <p className="text-gray-600">Software Engineer</p>
              </li>
              <li className="p-4 border border-gray-200 rounded-xl">
                <p className="font-semibold text-gray-900">Hazza Alhashmi</p>
                <p className="text-gray-600">Software Engineer</p>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-orange-500 mb-2">What We’re Building</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Secure CSV upload with schema mapping to mandated domains.</li>
              <li>Automated validation and quality checks to reduce data errors.</li>
              <li>Dashboard for Quality Indicator tracking and basic analytics.</li>
              <li>Export and reporting workflows to support B2G submission.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-orange-500 mb-2">Our Principles</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><span className="font-medium">Privacy & Security:</span> Least-privilege access, encryption in transit and at rest.</li>
              <li><span className="font-medium">Accessibility:</span> Clear UI, assistive-tech friendly components, and sensible defaults.</li>
              <li><span className="font-medium">Reliability:</span> Deterministic data mapping and auditability for peace of mind.</li>
            </ul>
          </section>

          <section className="mb-2">
            <h2 className="text-xl font-semibold text-orange-500 mb-2">Contact</h2>
            <p className="text-gray-700">
              Questions or collaboration ideas? Reach us at{" "}
              <span className="font-semibold">caredata@uow.edu.au</span>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
