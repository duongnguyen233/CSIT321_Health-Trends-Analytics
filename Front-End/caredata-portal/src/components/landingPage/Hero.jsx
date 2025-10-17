import Button from "../common/Button";

export default function Hero() {
  return (
    <section className="relative h-screen w-full flex items-center justify-center text-center text-white overflow-hidden bg-black">
      {/* Background Image */}
      <img
        src="/banner.png" // <-- Replace with your banner image path
        alt="Care Data Banner"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* Bottom Blur + Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-white/60 blur-lg pointer-events-none"></div>

      {/* Text Content */}
      <div className="relative z-10 px-6 max-w-3xl">
        <h1 className="text-5xl sm:text-6xl font-extrabold mb-6 drop-shadow-lg whitespace-nowrap">
  Upload. Convert. Comply.
</h1>
        <p className="text-2xl text-gray-200 mb-10 drop-shadow-md">
          Turn your aged-care facility data into government-standard CSVs
          effortlessly — with no manual formatting, no guesswork.
        </p>
        <Button className="bg-primary text-black px-8 py-3 text-lg rounded-md hover:bg-orange-600 transition-all shadow-lg">
          Get Started Today
        </Button>
      </div>
    </section>
  );
}
