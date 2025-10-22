import Navbar from "../common/Navbar";
import Footer from "../common/Footer";

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-grow pb-12 px-4 sm:px-6 flex justify-center pt-32">
        <div className="bg-white max-w-4xl w-full rounded-2xl shadow p-8 border border-gray-200 ">
          <h1 className="text-3xl font-semibold text-gray-900 mb-4 text-center">
            Contact Us
          </h1>
          <p className="text-gray-700 text-center mb-8">
            Have questions, feedback, or technical issues? Get in touch with our team.
          </p>

          <form className="space-y-5 max-w-lg mx-auto">
            <div>
              <label className="block text-gray-700 mb-1 font-medium">Name</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1 font-medium">Email</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-1 font-medium">Message</label>
              <textarea
                rows="4"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Your message..."
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-white font-medium py-2 rounded-md hover:bg-orange-600 transition"
            >
              Send Message
            </button>
          </form>

          <div className="mt-10 text-center text-gray-600 text-sm">
            <p>
              Project developed by <span className="font-semibold text-orange-400">Team W08</span>,
              University of Wollongong.
            </p>
            <p>Email: <span className="text-orange-400">caredata@uow.edu.au</span></p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
