import { useNavigate } from "react-router-dom";

export default function FormFilling() {
  const navigate = useNavigate();

  return (
    <section className="relative bg-white py-24 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        {/* 📝 Left side */}
        <div className="text-left">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
            Questionnaire
          </p>
          <h2 className="text-4xl font-bold text-gray-900 mb-6">Form Filling</h2>
          <p
            className="text-gray-600 leading-relaxed mb-8 text-justify"
            style={{ hyphens: "auto" }}
          >
            Simplify your data entry process with intuitive electronic forms
            that replace traditional paper records. Our platform streamlines
            information capture, reduces manual errors, and ensures all data is
            instantly organized and accessible. Experience greater efficiency,
            accuracy, and compliance across your aged care reporting workflow.
          </p>
          <button
            onClick={() => navigate("/questionnaire")}
            className="bg-primary text-white px-6 py-3 rounded-md font-medium hover:bg-orange-600 transition-all shadow-md"
          >
            More Information
          </button>
        </div>

        {/* 🖼️ Right side — refined grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Column 1: two stacked images closer together */}
          <div className="flex flex-col gap-3 justify-center">
            <div className="relative w-full h-56 rounded-2xl overflow-visible flex justify-center items-center">
              <img
                src="/form1.png"
                alt="Form Example 1"
                className="w-full h-full object-contain scale-110 drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
              />
            </div>
            <div className="relative w-full h-64 rounded-2xl overflow-visible flex justify-center items-center">
              <img
                src="/form2.png"
                alt="Form Example 2"
                className="w-full h-full object-contain scale-110 drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
              />
            </div>
          </div>

          {/* Column 2: one tall image */}
          <div className="relative w-full h-[460px] rounded-2xl overflow-visible flex justify-center items-center">
            <img
              src="/form3.png"
              alt="Form Example 3"
              className="w-full h-full object-contain scale-110 drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
