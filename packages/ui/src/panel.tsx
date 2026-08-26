import type { ReactNode } from "react";

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)] ${className}`}
    >
      {title || action ? (
        <div className="mb-3 flex items-center justify-between">
          {title ? (
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
