import { motion } from "framer-motion";

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

  // Animation presets
  const container = {
    hidden: { opacity: 0, y: 40 },
    visible: (delay = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, delay, ease: "easeOut" },
    }),
  };

  return (
    <section className="relative bg-white py-20 overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-6">
        {/* Section heading */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={container}
          className="text-left mb-12"
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
            Purposes
          </p>
          <h2 className="text-4xl font-bold text-gray-900 leading-tight">
            Why Choosing Us
          </h2>
        </motion.div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-10">
          {reasons.map((reason, idx) => (
            <motion.div
              key={idx}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 text-left border border-gray-100"
              variants={container}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              custom={idx * 0.2} // small stagger delay
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {reason.title}
              </h3>
              <p
                className="text-gray-600 leading-relaxed text-justify"
                style={{ hyphens: "auto" }}
              >
                {reason.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
