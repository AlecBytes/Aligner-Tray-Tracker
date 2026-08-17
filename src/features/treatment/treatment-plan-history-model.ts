import type { TreatmentPlanVersion } from '@/db/schema';

export type TreatmentPlanHistoryItem = TreatmentPlanVersion & {
  isCurrent: boolean;
};

export function createTreatmentPlanHistoryReadModel(
  versions: TreatmentPlanVersion[],
): TreatmentPlanHistoryItem[] {
  return versions.map((version, index) => ({
    ...version,
    isCurrent: index === 0,
  }));
}

export function formatPrescribedMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || hours === 0) {
    parts.push(`${minutes}m`);
  }

  return parts.join(' ');
}
