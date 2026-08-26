export function Statistic({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {label}
      </span>
      <span className="font-medium tabular-nums text-[var(--color-text)]">
        {value}
      </span>
    </div>
  );
}
