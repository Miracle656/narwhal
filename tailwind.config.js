/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        narwhal: {
          bg: "#020c1b",       // Deep Abyss
          card: "#0a192f",     // Midnight Navy
          cyan: "#64ffda",     // Electric Cyan
          lime: "#c0ff00",     // Neon Lime
          hover: "rgba(100, 255, 218, 0.1)",
        },
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'], // Brutalist Mono
      },
      boxShadow: {
        'neon': '0 0 10px #64ffda',
        'lime': '0 0 10px #c0ff00',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      }
    },
  },
  plugins: [],
}
