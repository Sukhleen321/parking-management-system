/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        gray: {
          950: '#050B18',
          900: '#0C1A2E',
          800: '#112240',
          700: '#1E3A5F',
          600: '#2A4F7A',
        },
      },
    },
  },
  plugins: [],
}
