/** @type {import('tailwindcss').Config} */
const colors = require("./src/constants/colors");

module.exports = {
   darkMode: "class",
   content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
   presets: [require("nativewind/preset")],
   theme: {
      extend: {
         colors: {
            primary: {
               DEFAULT: colors.primary500,
               50: colors.primary50,
               500: colors.primary500,
               600: colors.primary600,
            },
            secondary: {
               DEFAULT: colors.secondary,
            },
         },
      },
   },
   plugins: [],
};
