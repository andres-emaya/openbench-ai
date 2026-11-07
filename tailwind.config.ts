import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#050816",
        card: "#0F172A",
        accent: "#3B82F6",
        text: "#E2E8F0",
        border: "rgba(148, 163, 184, 0.18)"
      },
      boxShadow: {
        glow: "0 0 40px rgba(59, 130, 246, 0.22)",
        panel: "0 24px 80px rgba(0, 0, 0, 0.32)",
        "inner-line": "inset 0 1px 0 rgba(255, 255, 255, 0.08)"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["SFMono-Regular", "Consolas", "monospace"]
      },
      backgroundImage: {
        "terminal-grid":
          "linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)"
      }
    }
  },
  plugins: [animate]
};

export default config;
