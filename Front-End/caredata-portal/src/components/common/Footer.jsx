import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-black text-gray-300 border-t border-gray-800 py-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        {/* Left Section */}
        <div className="text-center md:text-left">
          <p className="text-base">
            &copy; {new Date().getFullYear()}{" "}
            <span className="font-semibold text-orange-500">CareData Portal</span>. All rights reserved.
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Developed by{" "}
            <span className="font-medium text-orange-400">Team W08</span> · University of Wollongong
          </p>
        </div>

        {/* Right Section */}
        <div className="flex gap-8 text-base font-medium">
          <Link to="/privacy" className="hover:text-orange-400 transition">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-orange-400 transition">
            Terms
          </Link>
          <Link to="/contact" className="hover:text-orange-400 transition">
            Contact
          </Link>
        </div>
      </div>

      {/* Sub-footer Section */}
      <div className="mt-6 text-center text-sm text-gray-400 font-light leading-relaxed px-4">
        <p>
          Aligned with{" "}
          <span className="text-orange-500 font-medium">
            Australian Government Health API Standards
          </span>{" "}
          — ensuring secure, interoperable, and compliant healthcare data exchange.
        </p>
        <p>
          Built following digital health principles published at{" "}
          <a
            href="https://developer.health.gov.au/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:text-orange-300 underline-offset-2 hover:underline"
          >
            developer.health.gov.au
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
