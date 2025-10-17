import { useNavigate } from "react-router-dom";

export default function UploadDocument() {
  const navigate = useNavigate();

  return (
    <section className="relative bg-[#f8f8f8] py-24 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        {/* Left side — transparent image */}
        <div className="relative flex justify-center items-center">
          <img
            src="/banner_upload.png" // <-- your transparent PNG
            alt="Upload Documents"
            className="w-full max-w-lg relative z-10 drop-shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
          />
        </div>

        {/* Right side — text */}
        <div className="text-left">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
            Your Data
          </p>
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Upload Documents
          </h2>
          <p className="text-gray-600 leading-relaxed mb-8 text-justify" style={{ hyphens: "auto" }}>
            Upload your CSV files to effortlessly transfer data from your existing aged care
            system into the government-ready format. Our platform automatically validates and
            aligns your information with official domain standards, saving hours of manual
            reformatting and reducing the risk of submission errors. With built-in encryption and
            strict privacy controls, your data stays secure and fully compliant at every step.
          </p>
          <button
            onClick={() => navigate("/upload-csv")}
            className="bg-primary text-white px-6 py-3 rounded-md font-medium hover:bg-orange-600 transition-all shadow-md"
          >
            More Information
          </button>
        </div>
      </div>
    </section>
  );
}
