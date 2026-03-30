import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Design system colors from Section 6
        primary: {
          DEFAULT: '#2563EB', // Blue-600
          hover: '#1D4ED8',   // Blue-700
        },
      },
    },
  },
  plugins: [],
}

export default config
