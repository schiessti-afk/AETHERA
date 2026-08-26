import type { ReactNode } from "react";

export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)] ${className}`}
    >
      {title ? (
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
