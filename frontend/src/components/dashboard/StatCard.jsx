import Card from '../common/Card.jsx';

/**
 * @param value Already-formatted display value (ignored while loading).
 * @param tone 'primary' | 'neutral' | 'accent' — colours the icon tile.
 */
export default function StatCard({ icon: Icon, label, value, hint, tone = 'primary', loading = false }) {
  return (
    <Card as="article" className="stat-card" aria-busy={loading || undefined}>
      <div className="stat-card__top">
        <h2 className="stat-card__label">{label}</h2>
        <span className={`stat-card__icon stat-card__icon--${tone}`} aria-hidden="true">
          <Icon size={20} />
        </span>
      </div>
      {loading ? (
        <span className="skeleton skeleton--value" aria-hidden="true" />
      ) : (
        <p className="stat-card__value">{value}</p>
      )}
      {hint && <p className="stat-card__hint">{hint}</p>}
    </Card>
  );
}
