/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#165DFF',
        secondary: '#36CFC9',
        danger: '#FF4D4F',
        warning: '#FF7D00',
        success: '#52C41A',
        dark: {
          100: '#11447B',
          200: '#1B94E9',
          300: '#1E222A',
          400: '#14171D'
        }
      }
    },
  },
  plugins: [],
}

