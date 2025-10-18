import { motion } from "framer-motion";
import { ArrowLeftIcon, ArrowRightIcon, StarIcon } from "@heroicons/react/24/solid";

export default function ClientOverview() {
  const testimonials = [
    {
      name: "John Adam",
      role: "Aged Care Facility",
      review: "Wonderful service, easy to use and absolutely care-free.",
      image: "/client1.png",
      avatar: "/avarta1.jpg",
      rating: 4,
    },
    {
      name: "Elizabeth Donna",
      role: "Aged Care Facility",
      review: "Very helpful service, automate the process and secured.",
      image: "/client2.png",
      avatar: "/avarta2.png",
      rating: 4,
    },
    {
      name: "Kate Maguire",
      role: "Aged Care Facility",
      review: "I love what you guys offer, keep up the good work!",
      image: "/client3.png",
      avatar: "/avarta3.jpg",
      rating: 5,
    },
  ];

  // Animation variants
  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: (delay = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, delay, ease: "easeOut" },
    }),
  };

  return (
    <section className="relative bg-[#f8f8f8] py-24 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 text-center">
        {/* Section Header */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          custom={0.1}
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
            Testimonials
          </p>
          <h2 className="text-4xl font-bold text-gray-900 mb-12">
            Our Client Reviews
          </h2>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Left Arrow */}
          <button className="absolute left-0 top-1/2 -translate-y-1/2 bg-white shadow-md rounded-full p-3 hover:bg-primary hover:text-white transition">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>

          {testimonials.map((client, idx) => (
            <motion.div
              key={idx}
              className="relative rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all bg-gray-50"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              custom={idx * 0.2 + 0.2}
            >
              {/* Background image */}
              <img
                src={client.image}
                alt={client.name}
                className="w-full h-[420px] object-cover py-4"
              />

              {/* Overlay card */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-[85%] bg-white rounded-2xl shadow-xl p-5 text-center">
                <div className="flex justify-center -mt-12 mb-2">
                  <img
                    src={client.avatar}
                    alt={client.name}
                    className="w-16 h-16 rounded-full border-4 border-white shadow-md object-cover"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {client.name}
                </h3>
                <p className="text-sm text-gray-500 mb-3">{client.role}</p>
                <p className="text-gray-600 italic mb-4">
                  “{client.review}”
                </p>

                {/* Rating stars */}
                <div className="flex justify-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon
                      key={i}
                      className={`w-5 h-5 ${
                        i < client.rating ? "text-primary" : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Right Arrow */}
          <button className="absolute right-0 top-1/2 -translate-y-1/2 bg-white shadow-md rounded-full p-3 hover:bg-primary hover:text-white transition">
            <ArrowRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
