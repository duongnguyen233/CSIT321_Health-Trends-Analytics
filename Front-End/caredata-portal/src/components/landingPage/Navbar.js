import { useState } from "react";
import Button from "../common/Button";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const link = "text-base font-medium text-gray-700 hover:text-gray-900";

  return (
    <nav className="sticky top-0 z-50 bg-gray-200/95 backdrop-blur border-b border-gray-300 shadow-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="h-20 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="text-xl font-bold text-gray-900">
            CareData Portal
          </a>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#" className={`${link} font-semibold`}>Home</a>
            <a href="#" className={link}>Upload CSV</a>
            <a href="#" className={link}>Questionnaire Form</a>
            <a href="#" className={link}>My Data</a>
            <a href="#" className="text-base text-gray-500 hover:text-gray-700 underline">
              Register
            </a>
            <Button
              variant="secondary"
              size="md"
              className="bg-gray-800 text-white hover:bg-gray-900"
            >
              Log In
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-3 rounded-md hover:bg-gray-100"
            onClick={() => setOpen(!open)}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Mobile Dropdown */}
        {open && (
          <div className="md:hidden border-t border-gray-300 py-5 space-y-4">
            <a href="#" className={link}>Home</a>
            <a href="#" className={link}>Upload CSV</a>
            <a href="#" className={link}>Questionnaire Form</a>
            <a href="#" className={link}>My Data</a>
            <a href="#" className="text-gray-500 hover:text-gray-700 underline">
              Register
            </a>
            <Button
              variant="secondary"
              size="md"
              className="bg-gray-800 text-white w-full hover:bg-gray-900"
            >
              Log In
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
