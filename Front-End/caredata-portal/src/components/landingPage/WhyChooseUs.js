import Card from "../common/Card";

export default function WhyChooseUs() {
  const reasons = [
    { title: "Fast & Reliable", desc: "Submit reports in minutes, not hours." },
    { title: "Secure", desc: "Your data is encrypted end-to-end." },
    { title: "Trusted", desc: "Fully compliant with government standards." },
  ];

  return (
    <section className="bg-white py-16">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold mb-6">Why Choose CareData Portal?</h2>
        <p className="text-gray-600 mb-12">
          We simplify compliance, reduce reporting errors, and save your facility time.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {reasons.map((r, idx) => (
            <Card key={idx} title={r.title}>{r.desc}</Card>
          ))}
        </div>
      </div>
    </section>
  );
}
