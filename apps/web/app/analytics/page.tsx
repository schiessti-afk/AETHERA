import { Panel } from "@aethera/ui";

export default function AnalyticsPage() {
  return (
    <div className="flex h-full items-start justify-center p-8">
      <Panel title="Analytics" className="max-w-md">
        <p className="text-sm text-[var(--color-text)]">Airspace patterns</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Density and statistics land in Phase 3. Charts will answer a question,
          not decorate a dashboard.
        </p>
      </Panel>
    </div>
  );
}
