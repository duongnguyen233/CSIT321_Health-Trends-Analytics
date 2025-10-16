import Navbar from "../components/common/Navbar";
import Hero from "../components/landingPage/Hero";
import Features from "../components/landingPage/Features";
import HowItWorks from "../components/landingPage/HowItWorks";
import WhyChooseUs from "../components/landingPage/WhyChooseUs";
import Footer from "../components/common/Footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <WhyChooseUs />
      <Footer />
    </>
  );
}
