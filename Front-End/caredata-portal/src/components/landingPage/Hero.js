import Button from "../common/Button";

export default function Hero() {
  return (
    <section className="bg-gray-200 py-24">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-16">

        {/* Left Side Text */}
        <div
          className="flex-1 text-center md:text-left animate-fadeIn"
          style={{ animationDelay: "0.1s", animationFillMode: "backwards" }}
        >
          <p className="text-base text-gray-700 mb-3">
            Welcome to <span className="font-semibold">CareData Portal</span>
          </p>
          <h1 className="text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
            Streamlining Aged Care Data Service
          </h1>
          <p className="text-lg text-gray-700 mb-8 max-w-xl">
            CareData Portal simplifies reporting for aged care facilities,
            ensuring compliance, security, and efficiency with electronic forms,
            CSV uploads, and automated submissions.
          </p>
          <div className="flex gap-4 justify-center md:justify-start">
            <Button
              variant="secondary"
              size="lg"
              className="bg-gray-800 text-white hover:bg-gray-900 transform hover:scale-105 transition"
            >
              Get Started
            </Button>
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </div>
        </div>

        {/* Right Side Image with Float Animation */}
        <div
          className="flex-1 animate-float"
          style={{ animationDelay: "0.3s", animationFillMode: "backwards" }}
        >
          <img
            src="/caredata.png"
            alt="CareData Illustration"
            className="rounded-xl shadow-lg"
          />
        </div>
      </div>
    </section>
  );
}
