/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: '#050c0a',
        midnight: '#0b1912',
        forest: '#123524',
        jade: '#26c485',
        mint: '#9ef7c5',
        stroke: '#163b2a',
        panel: '#0f1d16',
      },
      fontFamily: {
        sans: ['\"Space Grotesk\"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(158, 247, 197, 0.25), 0 18px 55px -28px rgba(38, 196, 133, 0.55)',
      },
    },
  },
  plugins: [],
}
