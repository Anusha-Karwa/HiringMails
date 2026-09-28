import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Aqua brand, same as FlatMatch (500 = #4AD1C4). 500 is for fills with ink text; 700+ for aqua text on white.
        brand: {
          50: "#effcfa",
          100: "#d2f6f2",
          200: "#a6ece5",
          300: "#74dfd4",
          400: "#5ed8cc",
          500: "#4ad1c4",
          600: "#259c91",
          700: "#1f7f77",
          800: "#1d6560",
          900: "#1a524e",
          950: "#0b3431",
        },
        ink: "#0f1f1c",
        muted: "#5b6d69",
        faint: "#8b9b97",
        line: "#e3ebe9",
        paper: "#f7faf9",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,31,28,0.04), 0 6px 20px -10px rgba(15,31,28,0.10)",
        lift: "0 2px 4px rgba(15,31,28,0.04), 0 16px 36px -16px rgba(31,127,119,0.30)",
      },
      keyframes: {
        spinslow: { to: { transform: "rotate(360deg)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-14px)" } },
      },
      animation: {
        spinslow: "spinslow 120s linear infinite",
        float: "float 12s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
