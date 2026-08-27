/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Solana-inspired palette
        solana: {
          green: '#14F195',
          purple: '#9945FF',
          blue: '#00D1FF',
          pink: '#DC1FFF',
          dark: '#0E0E1A',
          darker: '#080812',
          card: '#1A1A2E',
          border: '#2A2A40',
          muted: '#8B8BA3',
        },
        game: {
          available: '#1A2E1A',
          availableBorder: '#14F195',
          taken: '#2E1A1A',
          takenBorder: '#FF4444',
          selected: '#1A1A40',
          selectedBorder: '#9945FF',
          winner: '#2E2A0E',
          winnerBorder: '#FFD700',
          reserved: '#2E1A2E',
          reservedBorder: '#DC1FFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'count-up': 'countUp 0.5s ease-out',
        'confetti': 'confetti 1s ease-out forwards',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(20, 241, 149, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(20, 241, 149, 0.6)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(-100px) rotate(720deg)', opacity: '0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'solana-gradient': 'linear-gradient(135deg, #14F195 0%, #9945FF 100%)',
        'dark-gradient': 'linear-gradient(180deg, #0E0E1A 0%, #080812 100%)',
      },
    },
  },
  plugins: [],
};
