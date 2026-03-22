/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        notion: {
          bg: '#ffffff',
          sidebar: '#f7f7f5',
          hover: '#efefef',
          border: '#e0e0e0',
          text: '#37352f',
          muted: '#9b9b9b',
          blue: '#2383e2',
          red: '#e03e3e',
          green: '#4da74d',
          'bg-subtle': '#fbfbfa',
        },
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
};
