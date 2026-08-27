import { Suspense } from "react";
import { AirportExplorer } from "@/components/airport-explorer";

export default function AirportsPage() {
  return (
    <Suspense fallback={null}>
      <AirportExplorer />
    </Suspense>
  );
}
