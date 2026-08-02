// The app was running entirely on stock Tailwind: amber-500 is #f59e0b, a honey yellow, while the
// studio's orange is #ff7a29, a red-orange. Side by side the two apps read as different brands.
//
// Rather than rewrite 300+ colour classes across the JSX, the three ramps the app actually uses are
// remapped here to the studio's palette. Every existing `bg-amber-600`, `border-amber-900`,
// `text-gray-500` then picks up the right colour on its own.
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        // Matches the desktop site exactly: condensed caps for display, Inter for reading,
        // mono for anything that behaves like data on a run sheet.
        display: ["'Bebas Neue'", "Impact", "sans-serif"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        // The studio's orange, as a ramp. 500 is the brand value.
        amber: {
          50:'#fff4ec', 100:'#ffe4d1', 200:'#ffc9a6', 300:'#ffab73',
          400:'#ffa057',  // light accent / hover
          500:'#ff7a29',  // the brand orange
          600:'#ff7a29',  // button fills read as the brand value, not a darker step
          700:'#a84715',  // outlined-button borders
          800:'#5c2a10',
          900:'#3a2010',  // the hairline border on every card
          950:'#1f110a',
        },
        // Warm near-blacks. Tailwind's zinc carries a blue cast that fought the orange.
        zinc: { 700:'#2a2724', 800:'#171412', 900:'#0c0c0c', 950:'#050505' },
        // Warm greys. Stock gray-500 (#6b7280) is bluish and too dark on black for the amount of
        // small text this app puts on screen.
        gray: {
          200:'#e8e4dc', 300:'#d4cfc6', 400:'#b9b5ad',
          500:'#8a857d', 600:'#6b6660', 700:'#3d3a36', 800:'#242220', 900:'#141311',
        },
        ink:'#1a1006',    // near-black brown, for text on orange or on paper
        paper:'#f3efe6',  // cream surface, for inversions
        ember:'#ff4d2e',  // second heat, for offset shadows
      },
    }
  },
  plugins: []
}
