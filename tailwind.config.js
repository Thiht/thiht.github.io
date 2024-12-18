/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.html", "./content/**/*.md", "./static/icons/**/*.svg"],
  theme: {
    fontFamily: {
      'cursive': ['"Charm"', 'cursive'],
    },
    extend: {
      typography: {
        DEFAULT: {
          css: {
            'code': {
              // TODO: reference values from theme
              backgroundColor: '#f5f5f5',
              padding: '0.2em 0.4em',
              borderRadius: '0.25em',
              color: '#333',
              fontWeight: 'normal',
            },
            'code::before': {
              content: '""'
            },
            'code::after': {
              content: '""'
            }
          }
        }
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
