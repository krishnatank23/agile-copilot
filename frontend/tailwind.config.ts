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
        app: {
          bg:       "#09090f",
          surface:  "#11111b",
          surface2: "#161622",
        },
        brand: {
          50:  "rgba(217,70,239,0.05)",
          100: "rgba(217,70,239,0.10)",
          200: "rgba(217,70,239,0.20)",
          500: "#d946ef",
          600: "#9333ea",
          700: "#7e22ce",
        },
      },
    },
  },
  plugins: [],
};
export default config;
