/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#245B45',
          dark: '#193F32',
          light: '#2E7257'
        },
        ivory: '#FAF8F2',
        sage: '#E7EFE6',
        accent: '#D97745',
        primaryText: '#202A25',
        secondaryText: '#657169',
        borderLine: '#E3E7E0',
        brandSuccess: '#267348',
        brandWarning: '#A96017',
        brandError: '#B83D36'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'Manrope', 'sans-serif'],
      },
      borderRadius: {
        button: '7px',
        card: '10px'
      }
    },
  },
  plugins: [],
}
