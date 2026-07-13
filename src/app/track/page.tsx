import { Suspense } from "react";
import { TrackClient } from "@/components/orders/TrackClient";

export default function TrackPage() {
  return (
    <Suspense fallback={null}>
      <TrackClient />
    </Suspense>
  );
}
