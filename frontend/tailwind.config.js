/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          950: '#0a0a0a',
          900: '#121212',
          850: '#161616',
          800: '#1e1e1e',
          700: '#2a2a2a',
          600: '#3d3d3d',
          500: '#6b6b6b',
          400: '#9a9a9a',
          300: '#cbcbcb',
          200: '#e2e2e2',
          100: '#f4f4f4',
        },
        accent: {
          50: '#fff4ed',
          100: '#ffe6d5',
          200: '#ffc9a8',
          300: '#ffa869',
          400: '#ff7e29',
          500: '#f5610c',
          600: '#d6500a',
          700: '#b13e0a',
          800: '#8c3210',
          900: '#702b10',
        },
      },
      backgroundImage: {
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
        'accent-gradient': 'linear-gradient(135deg, #ff7e29, #d6500a)',
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'glow-accent': '0 0 20px rgba(245, 97, 12, 0.25)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
