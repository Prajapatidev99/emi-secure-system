/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          '50': '#edf2ff',
          '100': '#dbeafe',
          '200': '#bfdbfe',
          '300': '#93c5fd',
          '400': '#60a5fa',
          '500': '#3b82f6',
          '600': '#2563eb',
          '700': '#1d4ed8',
          '800': '#1e40af',
          '900': '#1e3a8a',
          '950': '#172554',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Accent colors for statuses
        teal: {
          100: '#d1fae5',
          600: '#059669',
          800: '#065f46',
          900: '#134e4a',
          300: '#6ee7b7'
        },
        amber: {
          100: '#fef3c7',
          500: '#f59e0b',
          800: '#92400e',
          900: '#78350f',
          300: '#fcd34d'
        },
        rose: {
          100: '#ffe4e6',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          300: '#fda4af'
        },
        sky: {
          100: '#e0f2fe',
          800: '#075985',
          900: '#0c4a6e',
          300: '#7dd3fc',
        },
        purple: {
          100: '#f3e8ff',
          800: '#6b21a8',
          900: '#581c87',
          300: '#d8b4fe'
        }
      },
      keyframes: {
        'fade-in': {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
        },
      },
      animation: {
          'fade-in': 'fade-in 0.3s ease-in-out',
      },
    },
  },
  plugins: [],
}