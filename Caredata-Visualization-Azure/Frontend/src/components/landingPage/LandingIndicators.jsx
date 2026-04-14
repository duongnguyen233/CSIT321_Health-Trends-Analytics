import { motion } from "framer-motion";

const INDICATORS = [
  { num: "QI 01", name: "Pressure injuries" },
  { num: "QI 02", name: "Restrictive practices" },
  { num: "QI 03", name: "Unplanned weight loss" },
  { num: "QI 04", name: "Falls & major injury" },
  { num: "QI 05", name: "Medications" },
  { num: "QI 06", name: "Activities of daily living" },
  { num: "QI 07", name: "Incontinence care" },
  { num: "QI 08", name: "Hospitalisation" },
  { num: "QI 09", name: "Workforce" },
  { num: "QI 10", name: "Consumer experience" },
  { num: "QI 11", name: "Quality of life" },
  { num: "QI 12", name: "Enrolled nursing" },
  { num: "QI 13", name: "Allied health" },
  { num: "QI 14", name: "Lifestyle officer" },
];

export default function LandingIndicators() {
  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: (delay = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, delay, ease: "easeOut" },
    }),
  };

  return (
    <section className="relative bg-light py-24 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          className="text-left mb-10"
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
            QI Program
          </p>
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            All 14 QI Program indicators supported
          </h2>
          <p className="text-gray-600 leading-relaxed text-justify" style={{ hyphens: "auto" }}>
            Aligned to the National Mandatory QI Program Manual 4.0 · AIHW · April 2025
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {INDICATORS.map((ind, i) => (
            <motion.div
              key={ind.num}
              className="bg-white rounded-xl shadow-md border border-gray-100 p-4 text-left"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              custom={i * 0.05}
            >
              <div className="text-xs font-mono text-gray-500 mb-1">{ind.num}</div>
              <div className="text-sm font-semibold text-gray-900 leading-tight">{ind.name}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
