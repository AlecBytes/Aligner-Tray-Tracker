import { SetupScreen } from '@/features/treatment/setup-screen';
import { TreatmentRouteGate } from '@/features/treatment/treatment-route-gate';

export default function SetupRoute() {
  return (
    <TreatmentRouteGate whenPresent="/tracker">
      <SetupScreen />
    </TreatmentRouteGate>
  );
}
