import { BRAND } from '../../config/brand.js';

/**
 * Logo mark: a "TB" monogram on an ink plate framed by printer's crop marks.
 * Colours come from CSS tokens (see .brand-mark rules), so it adapts to the theme.
 * Decorative by default; pass `title` when the mark stands alone.
 */
export function BrandMark({ size = 40, title, className = '' }) {
  return (
    <svg
      className={`brand-mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {/* crop marks */}
      <path
        className="brand-mark__crop"
        d="M1 9h5M9 1v5M34 9h5M31 1v5M1 31h5M9 34v5M34 31h5M31 34v5"
      />
      {/* ink plate */}
      <rect className="brand-mark__plate" x="9" y="9" width="22" height="22" rx="4" />
      {/* T + B monogram */}
      <path
        className="brand-mark__letters"
        d="M12.4 14h7.2M16 14v12M21.6 14v12M21.6 14h3a2.8 2.8 0 0 1 0 5.6h-3M21.6 19.6h3.4a3.2 3.2 0 0 1 0 6.4h-3.4"
      />
    </svg>
  );
}

/**
 * Full logo: mark + wordmark (+ optional tagline).
 * variant="compact" shows the mark only, with the name kept for screen readers.
 */
export default function BrandLogo({ variant = 'full', tagline }) {
  if (variant === 'compact') {
    return (
      <span className="brand-logo brand-logo--compact">
        <BrandMark size={34} title={BRAND.name} />
      </span>
    );
  }
  return (
    <span className="brand-logo">
      <BrandMark size={40} />
      <span className="brand-logo__text">
        {/* Latin brand name keeps its own direction inside the Arabic UI */}
        <span className="brand-logo__name" lang="en" dir="ltr">
          {BRAND.name}
        </span>
        {tagline && <span className="brand-logo__tagline">{tagline}</span>}
      </span>
    </span>
  );
}
