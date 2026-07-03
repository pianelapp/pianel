/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './index.html',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'monospace'],
        mono: ['Orbitron', 'monospace'],
      },
      animation: {
        'slide-text': 'slide-text 4s ease-in-out infinite',
      },
      keyframes: {
        'slide-text': {
          '0%, 15%': { transform: 'translateX(10px)' },
          '85%, 100%': { transform: 'translateX(-40px)' },
        },
      },
    },
  },
  plugins: [],
};
