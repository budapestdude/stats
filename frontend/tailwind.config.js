/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        chess: {
          dark: '#769656',
          light: '#eeeed2',
          highlight: '#f6f669',
          border: '#404040',
        },
      },
    },
  },
  plugins: [],
}

