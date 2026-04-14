import { motion } from "framer-motion";

const FEATURES = [
  {
    name: "14-category QI dashboard",
    desc: "All Quality Indicator categories on a single scrollable dashboard with traffic-light status cards, trend charts, and severity breakdowns.",
    icon: "grid",
  },
  {
    name: "National benchmarking",
    desc: "Compare your facility rates against AIHW published national medians with percentile rankings and peer group analysis.",
    icon: "chart",
  },
  {
    name: "Voice biomarker screening",
    desc: "AI-powered voice analysis detects early signs of cognitive decline, stroke risk, and depression from 30-second recordings.",
    icon: "trend",
  },
  {
    name: "One-click data entry",
    desc: "Upload quarterly QI collection data via CSV with automatic validation against indicator definitions and schema checks.",
    icon: "upload",
  },
  {
    name: "Clinical risk alerts",
    desc: "Real-time alerts when residents trigger multiple indicators simultaneously or show significant voice biomarker deviation.",
    icon: "alert",
  },
  {
    name: "Audit-ready reports",
    desc: "Generate QI reports formatted for Department of Health submissions, board papers, and Quality & Safety Commission audits.",
    icon: "doc",
  },
];

const iconPaths = {
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  chart: "M18 20V10 M12 20V4 M6 20v-6",
  alert: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  trend: "M22 12h-4l-3 9L9 3l-3 9H2",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8",
};

function FeatureIcon({ name }) {
  const d = iconPaths[name] || iconPaths.doc;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-primary">
      <path d={d} />
    </svg>
  );
}

export default function LandingFeatures() {
  const container = {
    hidden: { opacity: 0, y: 40 },
    visible: (delay = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, delay, ease: "easeOut" },
    }),
  };

  return (
    <section id="features" className="relative bg-white py-20 overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={container}
          className="text-left mb-12"
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
            Features
          </p>
          <h2 className="text-4xl font-bold text-gray-900 leading-tight">
            Everything a facility manager needs
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-10">
          {FEATURES.map((f, idx) => (
            <motion.div
              key={f.name}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 text-left border border-gray-100"
              variants={container}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              custom={idx * 0.2}
            >
              <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center mb-3">
                <FeatureIcon name={f.icon} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{f.name}</h3>
              <p className="text-gray-600 leading-relaxed text-justify" style={{ hyphens: "auto" }}>
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
