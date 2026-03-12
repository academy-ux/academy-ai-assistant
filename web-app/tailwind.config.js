/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/streamdown/dist/*.js',
  ],
  theme: {
    fontFamily: {
      sans: ['"neue-haas-grotesk-display"', 'SF Pro Display', 'system-ui', 'sans-serif'],
    },
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg) translateZ(0)' },
          '100%': { transform: 'rotate(360deg) translateZ(0)' },
        },
        'spin-medium': {
          '0%': { transform: 'rotate(0deg) translateZ(0)' },
          '100%': { transform: 'rotate(360deg) translateZ(0)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0) translateZ(0)' },
          '25%': { transform: 'translateY(-3%) translateZ(0)' },
          '75%': { transform: 'translateY(1%) translateZ(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) translateZ(0)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0) translateZ(0)', filter: 'blur(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px) translateZ(0)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0) translateZ(0)', filter: 'blur(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px) translateZ(0)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0) translateZ(0)', filter: 'blur(0)' },
        },
        'fade-in-left': {
          '0%': { opacity: '0', transform: 'translateX(16px) translateZ(0)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateX(0) translateZ(0)', filter: 'blur(0)' },
        },
        'fade-in-right': {
          '0%': { opacity: '0', transform: 'translateX(-16px) translateZ(0)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateX(0) translateZ(0)', filter: 'blur(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateZ(0)' },
          '100%': { opacity: '1', transform: 'scale(1) translateZ(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%) translateZ(0)' },
          '100%': { transform: 'translateY(0) translateZ(0)' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%) translateZ(0)' },
          '100%': { transform: 'translateY(0) translateZ(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(var(--primary), 0)' },
          '50%': { boxShadow: '0 0 24px 6px rgba(var(--primary), 0.12)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0) translateZ(0)' },
          '33%': { transform: 'translateY(-8px) translateZ(0)' },
          '66%': { transform: 'translateY(-4px) translateZ(0)' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-1deg) translateZ(0)' },
          '50%': { transform: 'rotate(1deg) translateZ(0)' },
        },
        'pop': {
          '0%': { transform: 'scale(1) translateZ(0)' },
          '40%': { transform: 'scale(1.05) translateZ(0)' },
          '100%': { transform: 'scale(1) translateZ(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 3s ease-in-out infinite',
        'spin-slow': 'spin-slow 40s linear infinite',
        'spin-medium': 'spin-medium 2s linear infinite',
        'bounce-subtle': 'bounce-subtle 2.4s cubic-bezier(0.37, 0, 0.63, 1) infinite',
        'fade-in': 'fade-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-down': 'fade-in-down 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-left': 'fade-in-left 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-right': 'fade-in-right 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-down': 'slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'glow-pulse': 'glow-pulse 2.5s cubic-bezier(0.37, 0, 0.63, 1) infinite',
        'float': 'float 4s cubic-bezier(0.37, 0, 0.63, 1) infinite',
        'wiggle': 'wiggle 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'pop': 'pop 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        peach: {
          DEFAULT: 'hsl(var(--peach))',
          foreground: 'hsl(var(--foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--secondary))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
