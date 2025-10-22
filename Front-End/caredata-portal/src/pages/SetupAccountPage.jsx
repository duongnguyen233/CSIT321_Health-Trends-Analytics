import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";

export default function SetupAccountPage() {
  const [account, setAccount] = useState({
    avatar: "",
    firstName: "",
    lastName: "",
    facilityName: "",
    abn: "",
    street: "",
    state: "",
    postcode: "",
    contactEmail: "",
    contactPhone: "",
  });

  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAccount((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAccount((prev) => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    console.log("Account setup:", account);
    setSuccess(true);
  };

  // ⏱️ Auto redirect after 4 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate("/"); // go back to LandingPage
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/3177/3177440.png";

  // --- Success Screen ---
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center">
        <img
          src="/success.png"
          alt="Success"
          className="w-24 h-24 mb-6"
        />
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Account created successfully!
        </h2>
        <p className="text-gray-500 mb-8">
          Welcome aboard! Redirecting you to the homepage...
        </p>
        <button
          onClick={() => navigate("/")}
          className="bg-orange-500 text-white px-6 py-2.5 rounded-md font-medium hover:bg-orange-600 transition"
        >
          Let’s Start!
        </button>
      </div>
    );
  }

  // --- Normal Setup Page ---
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 pt-10">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-24 pb-12 px-4 sm:px-6 max-w-[1280px] mx-auto gap-6">
        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3 text-center">
            Setup Your Account
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Complete your profile and facility details to start using CareData Portal.
          </p>

          {/* Avatar + Name Section */}
          <div className="flex items-center gap-10 mb-10">
            <div className="flex flex-col items-center justify-center">
              <img
                src={account.avatar || defaultAvatar}
                alt="User Avatar"
                className="w-28 h-28 rounded-full border-4 border-gray-200 shadow-sm object-cover"
              />
              <label className="mt-3 text-sm text-orange-600 font-medium cursor-pointer hover:underline">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                Upload Avatar
              </label>
            </div>

            <div className="flex flex-col justify-center space-y-4 w-2/3 max-w-sm">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  name="firstName"
                  value={account.firstName}
                  onChange={handleChange}
                  className="w-[100%] border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  name="lastName"
                  value={account.lastName}
                  onChange={handleChange}
                  className="w-[100%] border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter last name"
                />
              </div>
            </div>
          </div>

          {/* Facility Info */}
          <div className="space-y-4 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Facility Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Facility Name
                </label>
                <input
                  name="facilityName"
                  value={account.facilityName}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter facility name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ABN
                </label>
                <input
                  name="abn"
                  value={account.abn}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter ABN number"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street
                </label>
                <input
                  name="street"
                  value={account.street}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Street Address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  name="state"
                  value={account.state}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="State"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Postcode
                </label>
                <input
                  name="postcode"
                  value={account.postcode}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Postcode"
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <input
                  name="contactEmail"
                  type="email"
                  value={account.contactEmail}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter contact email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  name="contactPhone"
                  type="tel"
                  value={account.contactPhone}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center mt-10">
            <button
              onClick={handleSubmit}
              className="bg-orange-500 text-white px-6 py-2 rounded-md font-medium hover:bg-orange-600 transition"
            >
              Complete Setup
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
