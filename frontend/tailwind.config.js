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
          950: '#0a0a0f',
          900: '#111118',
          850: '#16161f',
          800: '#1c1c28',
          700: '#2a2a3a',
          600: '#3a3a50',
          500: '#6b7280',
          400: '#9ca3af',
          300: '#d1d5db',
          200: '#e5e7eb',
          100: '#f3f4f6',
        },
      },
      backgroundImage: {
        'instagram-gradient': 'linear-gradient(135deg, #f97316, #ec4899, #a855f7)',
        'instagram-gradient-h': 'linear-gradient(90deg, #f97316, #ec4899, #a855f7)',
        'instagram-gradient-v': 'linear-gradient(180deg, #f97316, #ec4899, #a855f7)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
      },
      animation: {
        'gradient-x': 'gradient-x 4s ease infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
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
        'glow-pink': '0 0 20px rgba(236, 72, 153, 0.3)',
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.3)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
