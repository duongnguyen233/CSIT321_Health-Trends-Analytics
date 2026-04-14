/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        primary: "#b08968",        // warm camel/tan accent
        "primary-hover": "#9a7558", // darker tan for hover states
        "primary-light": "#f0e6dc", // warm beige for light backgrounds
        dark: "#4a3f35",           // warm dark brown (navbar/hero)
        light: "#faf6f1",          // warm cream
        grayish: "#6b5e52",       // warm medium brown
        sand: "#c4b596",          // sand/tan mid-tone
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(to bottom, #4a3f35, #b08968)",
      },
      keyframes: {
        gradient: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        gradient: "gradient 6s ease infinite",
      },
    },
  },
  plugins: [],
};
