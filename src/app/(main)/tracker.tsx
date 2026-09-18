import { TrackerScreen } from '@/features/tracker/tracker-screen';
import { RetainerTrackerScreen } from '@/features/retainer/retainer-tracker-screen';
import { useTrackingMode } from '@/features/retainer/use-tracking-mode';
import { AppLoadingScreen } from '@/components/app-loading-screen';
export default function TrackerRoute() {
  const { mode, error } = useTrackingMode();
  if (!mode || error) return <AppLoadingScreen message={error ?? 'Checking local data…'} />;
  return mode.kind === 'retainer' ? <RetainerTrackerScreen /> : <TrackerScreen />;
}
