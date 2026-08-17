import { TreatmentRouteGate } from '@/features/treatment/treatment-route-gate';

export default function AppEntryRoute() {
  return <TreatmentRouteGate whenMissing="/setup" whenPresent="/tracker" />;
}
