import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "tertiary";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-background)] hover:opacity-90",
  secondary:
    "bg-[var(--color-surface-interactive)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-selected)]",
  tertiary:
    "bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
};

export function Button({
  variant = "secondary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium tracking-wide uppercase transition-opacity duration-[var(--motion-fast)] disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
