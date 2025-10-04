import Navbar from "../components/landingPage/Navbar";
import Hero from "../components/landingPage/Hero";
import Features from "../components/landingPage/Features";
import HowItWorks from "../components/landingPage/HowItWorks";
import WhyChooseUs from "../components/landingPage/WhyChooseUs";
import Footer from "../components/landingPage/Footer";

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
