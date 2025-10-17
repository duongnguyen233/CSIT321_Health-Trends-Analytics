export default function WhyChooseUs() {
  const reasons = [
    {
      title: "Secure & Compliant",
      desc: "Our platform ensures your data is securely submitted, keeping you compliant with all government regulations."
    },
    {
      title: "Time-Saving Efficiency",
      desc: "Reduce administrative burdens by automating the data reporting process, saving your team valuable time."
    },
    {
      title: "Tailored Solutions",
      desc: "Whether you’re uploading CSV files or integrating with an existing system, we provide flexible solutions that meet your facility’s needs."
    }
  ];

  return (
    <section className="relative bg-white py-20 overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-left mb-12">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
            Purposes
          </p>
          <h2 className="text-4xl font-bold text-gray-900 leading-tight">
            Why Choosing Us
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          {reasons.map((reason, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 text-left border border-gray-100"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {reason.title}
              </h3>
              {/* 👇 justify the copy inside each card */}
              <p className="text-gray-600 leading-relaxed text-justify" style={{ hyphens: "auto" }}>
                {reason.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
