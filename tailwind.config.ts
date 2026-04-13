import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        huginn: {
          base: '#12122a',
          surface: '#161630',
          card: '#1e1e3e',
          hover: '#242450',
          border: '#2a2a4a',
          accent: '#6c5ce7',
          'accent-hover': '#5b4bd5',
          'accent-soft': 'rgba(108,92,231,0.15)',
          success: '#00b894',
          warning: '#fdcb6e',
          danger: '#e17055',
          'text-primary': '#e8e8f0',
          'text-secondary': '#888888',
          'text-muted': '#555555',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
