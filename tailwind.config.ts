import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cor institucional do sistema — usada em botões primários, links
        // ativos da sidebar, focus rings, etc. Paleta azul-marinho (Real
        // Domínio: preto, azul escuro e branco).
        brand: {
          50: "#eef2fb",
          100: "#dce6f7",
          200: "#b9cdef",
          300: "#8aa9e2",
          400: "#5a80d1",
          500: "#3660bb",
          600: "#1e429e",
          700: "#16327b",
          800: "#0f2359",
          900: "#0a1938",
          950: "#050d1f",
        },
        // Chrome escuro (sidebar/topbar) — quase preto.
        ink: {
          800: "#141a29",
          900: "#0a0e17",
          950: "#05070c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
