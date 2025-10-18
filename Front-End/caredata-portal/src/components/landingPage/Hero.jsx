import { motion } from "framer-motion";
import Button from "../common/Button";
import { useNavigate } from "react-router-dom";

export default function Hero() {
  const navigate = useNavigate();
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.25 },
    },
  };

  const item = {
    hidden: { y: 80, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  return (
    <section className="relative flex items-center justify-center text-center text-white bg-black"
             style={{ minHeight: "115vh", overflow: "visible", paddingBottom: "4rem" }}>

      {/* Background image gently zooming */}
      <motion.img
        src="/banner.png"
        alt="Care Data Banner"
        className="absolute inset-0 w-full h-full object-cover object-center"
        initial={{ scale: 1.1, opacity: 0.8 }}
        animate={{ scale: [1.1, 1, 1.05], opacity: 1 }}
        transition={{
          duration: 12,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-white/70 pointer-events-none"></div>

      {/* Floating orange glow */}
      <motion.div
        className="absolute top-1/3 left-1/2 w-[400px] h-[400px] bg-orange-500/20 rounded-full blur-3xl -translate-x-1/2"
        animate={{ y: [0, -30, 0], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Smaller ambient glow */}
      <motion.div
        className="absolute bottom-1/4 right-1/3 w-[250px] h-[250px] bg-primary/25 rounded-full blur-3xl"
        animate={{ y: [0, 25, 0], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 px-6 max-w-4xl pb-16">
        {/* Animated heading */}
        <motion.div
          className="flex justify-center gap-3 mb-10 pb-8 pt-4" // more top & bottom padding
          variants={container}
          initial="hidden"
          animate="visible"
          style={{
            overflow: "visible",
            lineHeight: 1.35,              // extra breathing room for descenders
            marginBottom: "2rem",
          }}
        >
          {["Upload.", "Convert.", "Comply."].map((word, i) => (
            <motion.span
              key={i}
              variants={item}
              className="inline-block text-5xl sm:text-6xl font-extrabold
                        bg-gradient-to-r from-orange-700 via-orange-500 to-orange-300
                        bg-clip-text text-transparent drop-shadow-lg pb-3"
              style={{
                WebkitTextFillColor: "transparent",
                display: "inline-block",
                transformOrigin: "bottom center",
              }}
            >
              {word}
            </motion.span>
          ))}
        </motion.div>

        {/* Subtitle */}
        <motion.p
          className="text-2xl text-gray-200 mb-10 drop-shadow-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
        >
          Turn your aged-care facility data into government-standard CSVs
          effortlessly — with no manual formatting, no guesswork.
        </motion.p>

        {/* Button (one-time entrance only, no loop) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.8 }}
        >
          <Button
          onClick={() => navigate("/register")}
          className="bg-primary text-black px-10 py-4 text-lg rounded-full hover:bg-orange-600 hover:scale-105 transition-all font-semibold shadow-lg">
            Get Started Today
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
