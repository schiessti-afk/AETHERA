import { Panel } from "@aethera/ui";

export default function HistoryPage() {
  return (
    <div className="flex h-full items-start justify-center p-8">
      <Panel title="History" className="max-w-md">
        <p className="text-sm text-[var(--color-text)]">Replay is not available yet</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Historical exploration arrives in Phase 4, once durable tracks exist.
        </p>
      </Panel>
    </div>
  );
}
