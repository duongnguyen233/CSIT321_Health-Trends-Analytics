import { motion } from "framer-motion";
import Button from "../common/Button";
import { useNavigate } from "react-router-dom";

export default function Hero() {
  const navigate = useNavigate();

  const container = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.25 } },
  };

  const item = {
    hidden: { y: 80, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: "easeOut" } },
  };

  return (
    <section
      className="relative flex items-start justify-center text-center text-white bg-black pt-20"
      style={{ minHeight: "115vh", overflow: "visible", paddingBottom: "4rem" }}
    >
      {/* 160px black strip between navbar and banner image */}
      <div className="absolute top-0 left-0 w-full h-40 bg-[#040404] z-10" />

      {/* IMAGE + EFFECTS LAYER (offset by 160px) */}
      <div className="absolute top-40 left-0 right-0 bottom-0 overflow-hidden">
        {/* Background image (NO motion) */}
        <img
          src="/banner.png"
          alt="Care Data Banner"
          className="w-full h-full object-cover object-center"
        />

        {/* Gradient only on the last ~30%: transparent white -> solid white */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0) 70%, rgba(255,255,255,1) 100%)",
          }}
        />

        {/* Ambient glows (kept) */}
        <motion.div
          className="absolute bottom-1/4 right-1/3 w-[250px] h-[250px] bg-primary/25 rounded-full blur-3xl"
          animate={{ y: [0, 25, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* CONTENT WRAPPER (sits inside the black strip) */}
      <div className="relative z-20 px-6 max-w-2xl pb-16 pt-10">
        {/* Animated heading (white text) */}
        <motion.div
          className="flex justify-center gap-3 mb-8"
          variants={container}
          initial="hidden"
          animate="visible"
          style={{ lineHeight: 1.35 }}
        >
          {["Upload.", "Convert.", "Comply."].map((word, i) => (
            <motion.span
              key={i}
              variants={item}
              className="inline-block text-5xl sm:text-6xl font-bold text-white pb-5"
              style={{ display: "inline-block", transformOrigin: "bottom center" }}
            >
              {word}
            </motion.span>
          ))}
        </motion.div>

        {/* Subtitle */}
        <motion.p
          className="text-xl text-gray-200 mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
        >
          Turn your aged-care facility data into government-standard CSVs
          effortlessly — with no manual formatting, no guesswork.
        </motion.p>

        {/* Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.8 }}
        >
          <Button
            onClick={() => navigate("/register")}
            className="bg-primary text-black px-10 py-4 text-lg rounded-full hover:bg-orange-600 hover:scale-105 transition-all font-semibold shadow-lg"
          >
            Get Started Today
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
