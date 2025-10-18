import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function DataSubmission() {
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
    <section className="relative bg-[#fafafa] py-20 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 px-6">
        {/* Left image section */}
        <motion.div
          className="relative w-full lg:w-1/2 flex justify-center"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          custom={0.1}
        >
          {/* background shapes */}
          <div className="absolute top-0 left-0 w-3/4 h-3/4 bg-orange-100 rounded-[2rem] -z-10"></div>
          <div className="absolute bottom-0 right-0 w-3/4 h-3/4 bg-orange-200/60 rounded-[2rem] blur-3xl -z-20"></div>

          {/* PNG with transparent border */}
          <img
            src="/data_submission.png"
            alt="Data Submission"
            className="w-full max-w-lg relative z-10 drop-shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
          />
        </motion.div>

        {/* Right text section */}
        <motion.div
          className="lg:w-1/2 text-left"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          custom={0.3}
        >
          <h3 className="text-sm font-semibold text-orange-500 tracking-wider uppercase mb-2">
            Submission
          </h3>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Data Submission
          </h2>
          <p
            className="text-gray-600 leading-relaxed mb-8 text-justify"
            style={{ hyphens: "auto" }}
          >
            Automatically submit your facility’s data directly to government
            systems with just a few clicks. Our platform eliminates repetitive
            administrative tasks, minimizes the risk of submission errors, and
            keeps your reports consistently up to date. Ensure timely, accurate
            reporting while freeing your team to focus on quality care instead
            of paperwork.
          </p>
          <button
            onClick={() => navigate("/mydata")}
            className="bg-primary text-white px-6 py-3 rounded-md font-medium hover:bg-orange-600 transition-all shadow-md"
          >
            More Information
          </button>
        </motion.div>
      </div>

      {/* smooth gradient fade to next section */}
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-b from-transparent to-white"></div>
    </section>
  );
}
