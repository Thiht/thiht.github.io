/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.html", "./content/**/*.md", "./static/icons/**/*.svg"],
  theme: {
    fontFamily: {
      'cursive': ['"Charm"', 'cursive'],
    },
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
