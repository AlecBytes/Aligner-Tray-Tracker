import { Redirect, Slot, useGlobalSearchParams, usePathname } from 'expo-router';
import { useMemo } from 'react';
import { TimelineContext, TimelineScopeContext } from '@/features/edit-times/timeline-context';
import { retainerCorrections } from '@/features/retainer/retainer-corrections';
import { useTrackingMode } from '@/features/retainer/use-tracking-mode';
import { AppLoadingScreen } from '@/components/app-loading-screen';
export default function TimelineLayout() {
  const params = useGlobalSearchParams();
  const path = usePathname();
  const { mode, error } = useTrackingMode();
  const periodId = mode?.kind === 'retainer' ? mode.periodId : null;
  const repository = useMemo(() => periodId === null ? null : retainerCorrections(periodId), [periodId]);
  if (!mode || error) return <AppLoadingScreen message={error ?? 'Loading history…'} />;
  if (path !== '/edit-times' && ((periodId !== null && (params.timeline !== 'retainer' || Number(params.periodId) !== periodId)) || (periodId === null && params.timeline === 'retainer'))) return <Redirect href="/edit-times" />;
  return <TimelineScopeContext.Provider value={{ timeline: periodId === null ? 'treatment' : 'retainer', ...(periodId === null ? {} : { periodId }) }}><TimelineContext.Provider value={repository}><Slot /></TimelineContext.Provider></TimelineScopeContext.Provider>;
}
