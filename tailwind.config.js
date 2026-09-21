/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce8ff',
          200: '#b9d1ff',
          300: '#8fb3ff',
          400: '#5f8dff',
          500: '#3b66f5',
          600: '#2a4bd6',
          700: '#213aad',
          800: '#1c3089',
          900: '#1a2c6e',
        },
      },
    },
  },
  plugins: [],
};
