import { useState } from "react";
import Navbar from "../common/Navbar";
import Footer from "../common/Footer";
import MyDataSidebar from "./MyDataSidebar";

export default function SettingPage() {
  const [settings, setSettings] = useState({
    avatar: "",
    firstName: "Duong",
    lastName: "Nguyen",
    facilityName: "Care Data Facility A",
    abn: "12 345 678 910",
    street: "123 Health St",
    state: "NSW",
    postcode: "2500",
    contactEmail: "info@caredata.com",
    contactPhone: "+61 400 123 456",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings((prev) => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    console.log("Saved settings:", settings);
    alert("✅ Profile information saved successfully!");
  };

  const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/3177/3177440.png";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar active="My Data" />

      <main className="flex flex-grow pt-32 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto gap-6 w-full">
        {/* Sidebar */}
        <MyDataSidebar activePage="Settings" />

        {/* Main Settings Content */}
        <div className="flex-1 bg-white rounded-2xl shadow p-8 border border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3 text-center">
            User & Facility Settings
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Manage your personal details, facility information, and contact preferences.
          </p>

          {/* Avatar + Name Section */}
          <div className="flex items-center gap-10 mb-10">
            {/* Avatar (left side) */}
            <div className="flex flex-col items-center justify-center">
              <img
                src={settings.avatar || defaultAvatar}
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
                Change Avatar
              </label>
            </div>

            {/* Name fields (right side) */}
            <div className="flex flex-col justify-center space-y-4 w-2/3 max-w-sm">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  name="firstName"
                  value={settings.firstName}
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
                  value={settings.lastName}
                  onChange={handleChange}
                  className="w-[100%] border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter last name"
                />
              </div>
            </div>
          </div>

          {/* Facility Information */}
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
                  value={settings.facilityName}
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
                  value={settings.abn}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter ABN number"
                />
              </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street
                </label>
                <input
                  name="street"
                  value={settings.street}
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
                  value={settings.state}
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
                  value={settings.postcode}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Postcode"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
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
                  value={settings.contactEmail}
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
                  value={settings.contactPhone}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-gray-800 focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-center mt-10">
            <button
              onClick={handleSave}
              className="bg-orange-500 text-white px-6 py-2 rounded-md font-medium hover:bg-orange-600 transition"
            >
              Save Settings
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
