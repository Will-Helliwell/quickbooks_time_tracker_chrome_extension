/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./popup/**/*.{html,js}", "./background/**/*.js", "./*.html"],
  darkMode: "class", // Enable class-based dark mode
  theme: {
    extend: {
      width: {
        42: "10.5rem", // 168px
      },
    },
  },
  plugins: [],
};
