import { Panel } from "@aethera/ui";

export default function AlertsPage() {
  return (
    <div className="flex h-full items-start justify-center p-8">
      <Panel title="Alerts" className="max-w-md">
        <p className="text-sm text-[var(--color-text)]">No active alerts</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Detected conditions will appear here in Phase 2. Emergency squawks
          and unusual telemetry stay distinct from observed facts.
        </p>
      </Panel>
    </div>
  );
}
