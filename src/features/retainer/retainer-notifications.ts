import type { ReminderRequest } from '@/features/notifications/notification-policy';
import { automaticDeadline, nextLocalTime, type RetainerSnapshot } from './retainer-repository';
export function buildRetainerReminders(snapshot: RetainerSnapshot | null, now: number): ReminderRequest[] {
  if (!snapshot) return [];
  const { settings, punches, period } = snapshot;
  const latest = punches[0]; if (!latest) return [];
  const reminders: ReminderRequest[] = [];
  const cutoff = automaticDeadline(snapshot);
  const end = new Date(now); end.setDate(end.getDate() + 14);
  const add = (kind: 'retainer-bedtime' | 'retainer-morning', scheduledAt: number) => {
    if (scheduledAt <= now || scheduledAt > end.getTime()) return;
    reminders.push({ kind, scheduledAt, sound: 'default', fingerprint: `${kind}:${period.id}:${latest.id}:${scheduledAt}`, body: kind === 'retainer-bedtime' ? 'Time to put in your retainers.' : 'Good morning — remember to take out your retainers and mark them OUT.' });
  };
  if (settings.bedtime_enabled && (latest.status === 'OUT' || cutoff !== null)) {
    let time = nextLocalTime(Math.max(now, cutoff ?? now), settings.bedtime_minutes);
    for (let index = 0; index < 14; index++) { add('retainer-bedtime', time); time = nextLocalTime(time, settings.bedtime_minutes); }
  }
  if (settings.morning_enabled) {
    if (latest.status === 'IN') {
      let time = nextLocalTime(latest.timestamp, settings.morning_minutes);
      // With an assumed OUT, keep just this session's morning reminder.
      if (cutoff !== null) add('retainer-morning', time);
      else { time = nextLocalTime(now, settings.morning_minutes); for (let index = 0; index < 14; index++) { add('retainer-morning', time); time = nextLocalTime(time, settings.morning_minutes); } }
    } else if (latest.origin === 'automatic' && punches[1]?.status === 'IN') {
      add('retainer-morning', nextLocalTime(punches[1].timestamp, settings.morning_minutes));
    }
  }
  return reminders;
}
