import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#06070A",
        surface: "#0F121A",
        "surface-card": "#131722",
        "surface-border": "rgba(255, 255, 255, 0.08)",
        carbon: {
          DEFAULT: "#0F121A",
          surface: "rgba(15, 18, 26, 0.75)",
          border: "rgba(255, 255, 255, 0.08)",
        },
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "system-ui", "-apple-system", "sans-serif"],
        mono: [
          "var(--font-jetbrains-mono)",
          "var(--font-mono)",
          "ui-monospace",
          "Menlo",
          "Consolas",
          "Courier New",
          "monospace",
        ],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ping-slow": "ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
