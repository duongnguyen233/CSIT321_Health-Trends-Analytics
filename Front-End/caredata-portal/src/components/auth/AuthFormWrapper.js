import Navbar from "../common/Navbar";
import Footer from "../common/Footer";

export default function AuthFormWrapper({ title, children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-4 py-10">
        <div className="bg-white w-full max-w-md rounded-xl shadow-sm p-8">
          <h2 className="text-3xl font-semibold text-center mb-8 text-gray-800">
            {title}
          </h2>
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
