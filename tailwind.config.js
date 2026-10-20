/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand consistency: legacy orange utility classes now use the project's
        // brown palette without requiring each screen to carry a separate override.
        orange: {
          50: "#fbf7f3",
          100: "#f4e9df",
          200: "#e8d2c0",
          300: "#d7b59b",
          400: "#bd9070",
          500: "#8a6247",
          600: "#6f4e37",
          700: "#553722",
          800: "#432b1c",
          900: "#321f14",
          950: "#24150e"
        },
        "on-secondary-fixed-variant": "#484828",
        "surface-variant": "#e4e2e2",
        "on-primary-fixed-variant": "#5f402a",
        "outline-variant": "#d4c3ba",
        "on-primary-container": "#eec1a4",
        "surface-container-lowest": "#ffffff",
        "inverse-surface": "#303030",
        "tertiary-fixed-dim": "#ffb783",
        "surface-bright": "#F6F1E7",
        "secondary-fixed": "#e6e5b9",
        "primary": "#553722",
        "on-primary-fixed": "#2d1604",
        "tertiary-container": "#864300",
        "primary-fixed-dim": "#eabda0",
        "inverse-primary": "#eabda0",
        "on-background": "#1b1c1c",
        "on-secondary": "#ffffff",
        "inverse-on-surface": "#f2f0f0",
        "tertiary": "#633000",
        "secondary": "#60603e",
        "on-surface-variant": "#50453e",
        "on-tertiary-fixed": "#301400",
        "primary-container": "#6f4e37",
        "outline": "#82746d",
        "on-primary": "#ffffff",
        "error": "#ba1a1a",
        "on-tertiary": "#ffffff",
        "surface": "#F6F1E7",
        "tertiary-fixed": "#ffdcc5",
        "error-container": "#ffdad6",
        "surface-container-high": "#eae8e7",
        "primary-fixed": "#ffdcc6",
        "surface-dim": "#dbd9d9",
        "on-secondary-fixed": "#1d1d03",
        "secondary-container": "#e6e5b9",
        "surface-tint": "#79573f",
        "background": "#F6F1E7",
        "on-tertiary-container": "#ffbc8d",
        "secondary-fixed-dim": "#cac99f",
        "on-surface": "#1b1c1c",
        "surface-container-highest": "#e4e2e2",
        "on-tertiary-fixed-variant": "#713700",
        "on-secondary-container": "#666643",
        "on-error": "#ffffff",
        "surface-container-low": "#F6F1E7",
        "surface-container": "#efeded",
        "on-error-container": "#93000a"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      spacing: {
        "stack-lg": "32px",
        "gutter": "16px",
        "stack-sm": "8px",
        "unit": "8px",
        "container-margin": "20px",
        "stack-md": "16px"
      },
      fontFamily: {
        "label-md": ["Plus Jakarta Sans", "sans-serif"],
        "body-md": ["Plus Jakarta Sans", "sans-serif"],
        "headline-lg-mobile": ["Plus Jakarta Sans", "sans-serif"],
        "body-lg": ["Plus Jakarta Sans", "sans-serif"],
        "headline-md": ["Plus Jakarta Sans", "sans-serif"],
        "headline-lg": ["Plus Jakarta Sans", "sans-serif"],
        "label-sm": ["Plus Jakarta Sans", "sans-serif"]
      },
      fontSize: {
        "label-md": ["14px", {"lineHeight": "20px", "letterSpacing": "0.05em", "fontWeight": "600"}],
        "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
        "headline-lg-mobile": ["28px", {"lineHeight": "36px", "fontWeight": "700"}],
        "body-lg": ["18px", {"lineHeight": "28px", "fontWeight": "400"}],
        "headline-md": ["24px", {"lineHeight": "32px", "fontWeight": "600"}],
        "headline-lg": ["32px", {"lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "700"}],
        "label-sm": ["12px", {"lineHeight": "16px", "fontWeight": "500"}]
      }
    },
  },
  plugins: [],
}
