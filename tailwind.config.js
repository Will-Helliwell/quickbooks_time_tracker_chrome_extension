/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./popup/**/*.{html,js}", "./background/**/*.js", "./*.html"],
  theme: {
    extend: {
      width: {
        42: "10.5rem", // 168px
      },
    },
  },
  plugins: [],
};
