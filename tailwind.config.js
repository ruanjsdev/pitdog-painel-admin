/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pits: {
          orange: "#ff6a00",
          dark: "#070604",
          soft: "#100c08",
          panel: "#16100b",
        }
      }
    },
  },
  plugins: [],
}