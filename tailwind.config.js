/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'Assistant', 'Arial', 'sans-serif'],
      },
      colors: {
        // Summer 2026 watermelon palette — muted, professional tones (not candy-bright)
        watermelon: {
          peach: '#F8A88F',     // primary background wash / primary accent
          peachLight: '#FDEAE3',
          peachDark: '#E88B70',
          flesh: '#E85C5C',     // watermelon red accent (decorative only)
          fleshDark: '#C94848',
          rind: '#4E8F72',      // rind green (decorative slices)
          rindLight: '#DCEEE5',
          green: '#2D6A4F',     // primary watermelon green — buttons, focus states, badges
          cream: '#FFFBF7',
          softGray: '#F5F5F5',  // secondary surfaces
          danger: '#E53E3E',    // reserved for destructive actions only
          ink: '#1A202C',       // primary text
          muted: '#718096',     // secondary text
        },
      },
      spacing: {
        '4.5': '1.125rem',
      },
      keyframes: {
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-fast': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '60%': { opacity: '1', transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-14px) rotate(3deg)' },
        },
        'float-slow-reverse': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(14px) rotate(-3deg)' },
        },
        'draw-wave': {
          '0%': { strokeDashoffset: '1' },
          '100%': { strokeDashoffset: '0' },
        },
        'gradient-x': {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        'shimmer-sweep': {
          '0%': { transform: 'translateX(150%) skewX(-15deg)' },
          '100%': { transform: 'translateX(-150%) skewX(-15deg)' },
        },
        'pulse-border': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(45,106,79,0.25)' },
          '50%': { boxShadow: '0 0 0 6px rgba(45,106,79,0)' },
        },
      },
      animation: {
        blob: "blob 7s infinite",
        'fade-in': 'fade-in 500ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in-fast': 'fade-in-fast 200ms ease-out both',
        'fade-in-up': 'fade-in-up 600ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slide-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'bounce-in': 'bounce-in 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'float-slow': 'float-slow 9s ease-in-out infinite',
        'float-slow-reverse': 'float-slow-reverse 11s ease-in-out infinite',
        'draw-wave': 'draw-wave 1.8s cubic-bezier(0.65, 0, 0.35, 1) both',
        'gradient-x': 'gradient-x 3s ease infinite',
        'shimmer-sweep': 'shimmer-sweep 2.5s infinite',
        'pulse-border': 'pulse-border 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
