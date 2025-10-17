/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#ff7b00",   // orange accent
        dark: "#111111",      // deep black background
        light: "#f9f9f9",     // soft white for text backgrounds
        grayish: "#1a1a1a",   // subtle gray for sections
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(to bottom, #000000, #ff7b00)",
      },
    },
  },
  plugins: [],
};