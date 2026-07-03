/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan the shared renderer package and the web-only host source so no utility
  // classes used by shared screens/components are purged.
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
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
