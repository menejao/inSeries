import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#f4efe6",
        ember: "#ff6b35",
        night: "#101828",
        ocean: "#12344d",
        mist: "#d9e2ec",
        line: "#243b53",
        success: "#2f855a",
        warning: "#b7791f"
      },
      boxShadow: {
        card: "0 20px 40px rgba(16, 24, 40, 0.12)"
      },
      borderRadius: {
        "4xl": "2rem"
      }
    }
  },
  plugins: []
};

export default config;
