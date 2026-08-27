type Props = {
  label: string;
  value: string;
  detail: string;
  tone?: "positive" | "negative" | "neutral";
  featured?: boolean;
};

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
  featured = false,
}: Props) {
  return (
    <article className={`metric-card${featured ? " metric-card--featured" : ""}`}>
      <p className="metric-card__label">{label}</p>
      <p className={`metric-card__value value--${tone}`}>{value}</p>
      <p className="metric-card__detail">{detail}</p>
    </article>
  );
}
