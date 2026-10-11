import { CircleCheck, Clock } from 'lucide-react';
import { CUSTOM_PAPER_SIZE, DEFAULT_DIMENSION_UNIT } from '../../constants/paperOptions.js';
import { useI18n } from '../../i18n/useI18n.js';
import { formatNumber } from '../../utils/format.js';

// Translates stable paper values (e.g. "art_paper") into display labels.
export function PaperTypeBadge({ value }) {
  const { t } = useI18n();
  return (
    <span className={`badge badge--type badge--${value}`}>
      <span className="badge__swatch" aria-hidden="true" />
      {t(`paperTypes.${value}`)}
    </span>
  );
}

/** Label for a paper size; custom sizes include their dimensions, e.g. "Custom (320 × 450 mm)". */
export function usePaperSizeLabel() {
  const { t, locale, numberingSystem } = useI18n();
  return (value, dimensions) => {
    if (value === CUSTOM_PAPER_SIZE && dimensions?.width && dimensions?.height) {
      const n = (x) => formatNumber(x, locale, numberingSystem);
      const unit = dimensions.unit || DEFAULT_DIMENSION_UNIT; // legacy values are millimeters
      // LTR isolate (U+2066…U+2069) keeps "width × height" in reading order inside Arabic text.
      return t('paperSizes.customWithSize', {
        dimensions: `⁦${n(dimensions.width)} × ${n(dimensions.height)}⁩`,
        unit: t(`units.${unit}`),
      });
    }
    return t(`paperSizes.${value}`);
  };
}

export function PaperSizeBadge({ value, dimensions }) {
  const label = usePaperSizeLabel();
  return (
    <span className={`badge badge--size ${value === CUSTOM_PAPER_SIZE ? 'badge--custom' : ''}`}>
      {label(value, dimensions)}
    </span>
  );
}

export function StatusBadge({ status }) {
  const { t } = useI18n();
  const value = status === 'completed' ? 'completed' : 'pending';
  const Icon = value === 'completed' ? CircleCheck : Clock;
  return (
    <span className={`badge badge--status badge--status-${value}`}>
      <Icon size={13} aria-hidden="true" />
      {t(`status.${value}`)}
    </span>
  );
}
