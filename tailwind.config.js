/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        barlow: ['Barlow', 'sans-serif'],
        condensed: ['Barlow Condensed', 'sans-serif'],
      },
      colors: {
        nokia: {
          green:  '#1a9c1a',
          dark:   '#0d6e0d',
          light:  '#27c727',
          faint:  '#e8f7e8',
          teal:   '#144E4A',
          tealLight: '#CDFBF2',
        },
      },
    },
  },
  plugins: [],
}
