
// ── NASHI design system: refined, soft-feminine palette ─────────────────────
// The default Tailwind scales used across the site are re-pointed here so every page
// picks up the new look at once: slate → warm mauve-grey, rose/pink → dusty rose,
// indigo/purple/violet/fuchsia → plum, emerald/green/teal → sage, amber/yellow/orange →
// champagne, blue/sky → dusty blue. red stays Tailwind's default (destructive actions).
const mauve = { 50:'#FAF7F6',100:'#F3EEEC',200:'#E7DFDC',300:'#D4C8C4',400:'#A99A97',500:'#85757A',600:'#6A5960',700:'#54444C',800:'#3D2F37',900:'#2B2027',950:'#1C1419' };
const dustyRose = { 50:'#FCF6F6',100:'#F8EAEA',200:'#F0D5D6',300:'#E4B6B9',400:'#D2959A',500:'#BD7A81',600:'#A5636B',700:'#8A5058',800:'#6F4148',900:'#5A363C',950:'#3A2226' };
const plum = { 50:'#F8F4F7',100:'#EFE6EC',200:'#DECBD8',300:'#C7A8BE',400:'#A9809F',500:'#8E6384',600:'#77506E',700:'#62425B',800:'#4F364A',900:'#3F2C3B',950:'#2A1D27' };
const sage = { 50:'#F4F7F4',100:'#E6EEE7',200:'#CDDDCF',300:'#ABC5AF',400:'#86A98C',500:'#6A8E71',600:'#55735B',700:'#465E4B',800:'#3A4C3E',900:'#303F34',950:'#1F2A22' };
const champagne = { 50:'#FBF7F0',100:'#F5ECDB',200:'#EBD8B6',300:'#DDBF8A',400:'#CDA466',500:'#B8894B',600:'#9C703D',700:'#7E5934',800:'#66482E',900:'#533B28',950:'#2F2116' };
const dustyBlue = { 50:'#F4F6F9',100:'#E6ECF2',200:'#CDD8E4',300:'#A9BCCF',400:'#849DB6',500:'#69829C',600:'#546A82',700:'#46576A',800:'#3A4858',900:'#313C49',950:'#1F2630' };

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
        sans: ['Assistant', 'Heebo', 'Arial', 'sans-serif'],
        // Antidott-like: geometric, airy, softly rounded. Antidott itself is used if installed/added later.
        display: ['Antidott', 'Rubik', 'Assistant', 'sans-serif'],
        serif: ['Antidott', 'Rubik', 'Assistant', 'sans-serif'],
      },
      // Lighter, more refined weights site-wide (the old design leaned on font-black everywhere)
      fontWeight: {
        black: '700',
        extrabold: '700',
      },
      boxShadow: {
        soft: '0 2px 20px -6px rgba(61, 47, 55, 0.10)',
        lift: '0 18px 40px -18px rgba(138, 80, 88, 0.28)',
        petal: '0 1px 2px rgba(61,47,55,0.04), 0 8px 28px -10px rgba(189,122,129,0.22)',
      },
      colors: {
        slate: mauve, gray: mauve, stone: mauve, zinc: mauve, neutral: mauve,
        rose: dustyRose, pink: dustyRose,
        indigo: plum, purple: plum, violet: plum, fuchsia: plum,
        emerald: sage, green: sage, teal: sage,
        amber: champagne, yellow: champagne, orange: champagne,
        blue: dustyBlue, sky: dustyBlue, cyan: dustyBlue,
        mauve, plum, sage, champagne, blush: dustyRose,
        ink: '#2B2027',
        cream: '#FBF7F4',
        // Legacy "watermelon" tokens — kept as names, re-pointed to the new palette
        // Summer 2026 watermelon palette — muted, professional tones (not candy-bright)
        watermelon: {
          peach: '#D2959A',     // primary background wash / primary accent
          peachLight: '#F8EAEA',
          peachDark: '#BD7A81',
          flesh: '#BD7A81',     // watermelon red accent (decorative only)
          fleshDark: '#A5636B',
          rind: '#86A98C',      // rind green (decorative slices)
          rindLight: '#F8EAEA',
          green: '#8A5058',     // primary watermelon green — buttons, focus states, badges
          cream: '#FBF7F4',
          softGray: '#F7F2F0',  // secondary surfaces
          danger: '#C8574F',    // reserved for destructive actions only
          ink: '#2B2027',       // primary text
          muted: '#85757A',     // secondary text
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
        'word-rise': {
          '0%': { opacity: '0', transform: 'translateY(105%) rotate(3deg)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0) rotate(0)', filter: 'blur(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(50%)' },
        },
        'mesh-drift': {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(6%,-8%) scale(1.12)' },
          '66%': { transform: 'translate(-5%,6%) scale(0.95)' },
          '100%': { transform: 'translate(0,0) scale(1)' },
        },
        'float-y': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        kenburns: {
          '0%': { transform: 'scale(1) translate(0,0)' },
          '100%': { transform: 'scale(1.1) translate(-1.5%, -1.5%)' },
        },
        'blur-in': {
          '0%': { opacity: '0', filter: 'blur(14px)', transform: 'scale(1.03)' },
          '100%': { opacity: '1', filter: 'blur(0)', transform: 'scale(1)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.92) translateY(18px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'clip-up': {
          '0%': { clipPath: 'inset(100% 0 0 0 round 2rem)', opacity: '0.4' },
          '100%': { clipPath: 'inset(0 0 0 0 round 2rem)', opacity: '1' },
        },
        'line-grow': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-border': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(189,122,129,0.30)' },
          '50%': { boxShadow: '0 0 0 6px rgba(189,122,129,0)' },
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
        'word-rise': 'word-rise 1100ms cubic-bezier(0.16, 1, 0.3, 1) both',
        marquee: 'marquee 38s linear infinite',
        'mesh-drift': 'mesh-drift 22s ease-in-out infinite',
        'mesh-drift-slow': 'mesh-drift 34s ease-in-out infinite reverse',
        'float-y': 'float-y 7s ease-in-out infinite',
        'float-y-slow': 'float-y 10s ease-in-out infinite',
        kenburns: 'kenburns 14s ease-out both',
        'blur-in': 'blur-in 1000ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 900ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'clip-up': 'clip-up 1200ms cubic-bezier(0.77, 0, 0.18, 1) both',
        'line-grow': 'line-grow 1200ms cubic-bezier(0.77, 0, 0.18, 1) both',
        'spin-slow': 'spin-slow 40s linear infinite',
      },
    },
  },
  plugins: [],
}
