import { buildRetainerReminders } from './retainer-notifications';
import type { RetainerSnapshot } from './retainer-repository';
import { formatDuration } from '@/features/tracker/tracker-calculations';

export function createRetainerTrackerModel(snapshot: RetainerSnapshot, now: number) {
  const [latest, previous] = snapshot.punches;
  const inside = latest.status === 'IN';
  const duration = inside ? now - latest.timestamp : previous?.status === 'IN' ? latest.timestamp - previous.timestamp : null;
  const nextReminder = buildRetainerReminders(snapshot, now).sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
  const reminder = nextReminder
    ? `${nextReminder.kind === 'retainer-morning' ? 'Morning reminder' : 'Bedtime reminder'}: ${new Date(nextReminder.scheduledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : snapshot.settings.bedtime_enabled || snapshot.settings.morning_enabled ? 'No upcoming reminder' : 'Reminders off';
  return {
    periodId: snapshot.period.id,
    durationLabel: inside ? 'Current wear' : 'Last wear',
    duration: duration === null ? 'No wear recorded' : formatDuration(Math.max(0, Math.floor(duration / 1000))),
    reminder,
  };
}
