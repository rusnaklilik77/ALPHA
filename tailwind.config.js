/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#071316",
        panel: "#0d1e22",
        panel2: "#11262b",
        border: "#1c363c",
        accent: "#0fb8ab",
        accent2: "#22c55e",
        danger: "#ef4444",
        muted: "#7f97a0",
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.35)",
      },
      borderRadius: {
        xl2: "1.1rem",
      },
    },
  },
  plugins: [],
}
