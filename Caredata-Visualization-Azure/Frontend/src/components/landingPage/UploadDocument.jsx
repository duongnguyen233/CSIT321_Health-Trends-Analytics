import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function UploadDocument() {
  const navigate = useNavigate();

  // Animation presets
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
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        {/* Left side — image */}
        <motion.div
          className="relative flex justify-center items-center"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          custom={0.1}
        >
          <img
            src="/banner_upload.png"
            alt="Upload Documents"
            className="w-full max-w-lg relative z-10 drop-shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
          />
        </motion.div>

        {/* Right side — text */}
        <motion.div
          className="text-left"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          custom={0.3}
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
            Data Entry
          </p>
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            One-click QI Data Upload
          </h2>
          <p
            className="text-gray-600 leading-relaxed mb-8 text-justify"
            style={{ hyphens: "auto" }}
          >
            Upload your quarterly QI collection data via CSV with automatic validation
            against indicator definitions and schema checks. The platform maps your
            facility's data to all 14 QI categories, flags values outside valid ranges,
            and highlights missing fields before submission. Built-in encryption and
            strict privacy controls keep resident data secure and fully compliant.
          </p>
          <button
            onClick={() => navigate("/upload-csv")}
            className="bg-primary text-white px-6 py-3 rounded-md font-medium hover:bg-primary-hover transition-all shadow-md"
          >
            Upload Data
          </button>
        </motion.div>
      </div>
    </section>
  );
}
