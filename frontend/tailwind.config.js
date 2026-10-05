/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border, 214 32% 91%))",
        input: "hsl(var(--input, 214 32% 91%))",
        ring: "hsl(var(--ring, 215 80% 48%))",
        background: "hsl(var(--background, 210 40% 98%))",
        foreground: "hsl(var(--foreground, 222 47% 11%))",
        primary: {
          DEFAULT: "hsl(var(--primary, 212 90% 44%))", // Municipal Ocean Blue
          foreground: "hsl(var(--primary-foreground, 210 40% 98%))",
          hover: "hsl(212 90% 38%)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary, 173 58% 39%))", // Estuary Teal
          foreground: "hsl(var(--secondary-foreground, 210 40% 98%))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent, 27 96% 54%))", // Alert Orange
          foreground: "hsl(var(--accent-foreground, 222 47% 11%))",
        },
        card: {
          DEFAULT: "hsl(var(--card, 0 0% 100%))",
          foreground: "hsl(var(--card-foreground, 222 47% 11%))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted, 210 40% 96%))",
          foreground: "hsl(var(--muted-foreground, 215 16% 47%))",
        },
        risk: {
          low: "#10b981", // Emerald
          medium: "#f59e0b", // Amber
          high: "#f97316", // Orange
          critical: "#ef4444", // Crimson
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'elevated': '0 10px 15px -3px rgba(0, 0, 0, 0.07), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
