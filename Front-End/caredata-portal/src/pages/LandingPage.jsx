import Navbar from "../components/common/Navbar";
import Hero from "../components/landingPage/Hero";
import ClientOverview from "../components/landingPage/ClientOverview";
import UploadDocument from "../components/landingPage/UploadDocument";
import WhyChooseUs from "../components/landingPage/WhyChooseUs";
import FormFilling from "../components/landingPage/FormFilling";
import DataSubmission from "../components/landingPage/DataSubmission";
import Footer from "../components/common/Footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <Hero />
      <WhyChooseUs />
      <UploadDocument />
      <FormFilling/>
      <DataSubmission />
      <ClientOverview />
      <Footer />
    </>
  );
}
