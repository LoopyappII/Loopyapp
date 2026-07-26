import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        loopy: {
          50: "#eef1fb",
          100: "#dde3f6",
          500: "#5b6fc4",
          600: "#4b58a8",
          700: "#3d4a8a",
          900: "#232a52",
        },
        glow: {
          400: "#f6b8e8",
          500: "#ec6fc9",
          600: "#c94fae",
        },
        // Puente entre loopy-700 (azul) y glow-600 (rosa): la mezcla que
        // reemplaza al rosa puro en sombras/acentos en toda la app.
        bridge: {
          DEFAULT: "#834c9c",
          400: "#a06bb8",
          600: "#6d3f83",
        },
      },
      boxShadow: {
        card: "0 8px 28px rgba(35,42,82,0.10)",
        "card-hover": "0 10px 36px rgba(35,42,82,0.16)",
        cta: "0 10px 36px rgba(131,76,156,0.35)",
        "cta-hover": "0 12px 44px rgba(131,76,156,0.5)",
        badge: "0 0 16px rgba(131,76,156,0.22)",
      },
      keyframes: {
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(131,76,156,0.45)" },
          "70%": { boxShadow: "0 0 0 22px rgba(131,76,156,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(131,76,156,0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2.2s cubic-bezier(0.4,0,0.6,1) infinite",
        float: "float 5s ease-in-out infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
