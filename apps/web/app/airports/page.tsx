import { Panel } from "@aethera/ui";

export default function AirportsPage() {
  return (
    <div className="flex h-full items-start justify-center p-8">
      <Panel title="Airports" className="max-w-md">
        <p className="text-sm text-[var(--color-text)]">Airport traffic views</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Phase 3 will show observed traffic around selected airports without
          leaving the map-first layout.
        </p>
      </Panel>
    </div>
  );
}
