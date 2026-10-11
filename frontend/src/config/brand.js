// Single source of truth for the application's branding.
// To rebrand: change these values, then update public/brand-mark.svg (favicon,
// loading screen) to match <BrandMark /> in components/brand/BrandLogo.jsx.
export const BRAND = Object.freeze({
  // Brand names are not translated: shown as-is in Arabic and English.
  name: 'The Best',
  // Monogram drawn inside the logo mark.
  monogram: 'TB',
  // Matches --color-primary (tokens.css) and <meta name="theme-color">.
  themeColor: '#0e5a6b',
});
