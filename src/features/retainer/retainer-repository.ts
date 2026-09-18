import type { SQLiteDatabase } from 'expo-sqlite';
import { withUserMutationTransaction, type SQLiteMutationTransaction } from '@/db/mutation-transaction';
import type { WearStatus } from '@/db/schema';

type Reader = Pick<SQLiteMutationTransaction, 'getFirstAsync' | 'getAllAsync'>;
export type TrackingMode = { kind: 'treatment'; treatmentId: number } | { kind: 'retainer'; treatmentId: number; periodId: number } | { kind: 'setup' };
export type RetainerSettings = {
  bedtime_enabled: number; bedtime_minutes: number;
  morning_enabled: number; morning_minutes: number;
  automatic_enabled: number; automatic_minutes: number; automatic_effective_at: number;
};
export type RetainerPunch = { id: number; retainer_period_id: number; status: WearStatus; timestamp: number; origin: 'manual' | 'automatic' | 'lifecycle' | 'correction'; auto_out_suppressed: number };
export type RetainerPeriod = { id: number; treatment_id: number; started_at: number; ended_at: number | null };
const listeners = new Set<() => void>();
export function notifyTrackingChanged() { listeners.forEach((listener) => listener()); }
export function subscribeTracking(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export async function getTrackingMode(db: Reader): Promise<TrackingMode> {
  const row = await db.getFirstAsync<{ treatment_id: number | null; retainer_id: number | null; retainer_treatment_id: number | null }>(`SELECT
    (SELECT id FROM treatments WHERE completed_at IS NULL LIMIT 1) AS treatment_id,
    (SELECT id FROM retainer_periods WHERE ended_at IS NULL LIMIT 1) AS retainer_id,
    (SELECT treatment_id FROM retainer_periods WHERE ended_at IS NULL LIMIT 1) AS retainer_treatment_id`);
  if (row?.treatment_id != null && row.retainer_id != null) throw new Error('Conflicting tracking modes.');
  if (row?.treatment_id != null) return { kind: 'treatment', treatmentId: row.treatment_id };
  if (row?.retainer_id != null && row.retainer_treatment_id != null) return { kind: 'retainer', periodId: row.retainer_id, treatmentId: row.retainer_treatment_id };
  return { kind: 'setup' };
}
export async function getRetainerSettings(db: Reader) {
  const settings = await db.getFirstAsync<RetainerSettings>('SELECT bedtime_enabled,bedtime_minutes,morning_enabled,morning_minutes,automatic_enabled,automatic_minutes,automatic_effective_at FROM retainer_settings WHERE id = 1');
  if (!settings) throw new Error('Retainer settings unavailable.');
  return settings;
}
export async function getRetainerSnapshot(db: Reader) {
  const period = await db.getFirstAsync<RetainerPeriod>('SELECT * FROM retainer_periods WHERE ended_at IS NULL');
  if (!period) return null;
  const punches = await db.getAllAsync<RetainerPunch>('SELECT * FROM retainer_wear_punches WHERE retainer_period_id = ? ORDER BY timestamp DESC, id DESC LIMIT 3', period.id);
  return { period, punches, settings: await getRetainerSettings(db) };
}
export type RetainerSnapshot = NonNullable<Awaited<ReturnType<typeof getRetainerSnapshot>>>;
export function nextLocalTime(after: number, minutes: number) {
  const date = new Date(after);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (date.getTime() <= after) {
    date.setDate(date.getDate() + 1);
    date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  }
  return date.getTime();
}
export function automaticDeadline(snapshot: RetainerSnapshot): number | null {
  const punch = snapshot.punches[0];
  const settings = snapshot.settings;
  if (!settings.automatic_enabled || !punch || punch.status !== 'IN' || punch.auto_out_suppressed) return null;
  return nextLocalTime(Math.max(punch.timestamp, settings.automatic_effective_at), settings.automatic_minutes);
}
async function reconcileInTransaction(db: SQLiteMutationTransaction, now: number) {
  const snapshot = await getRetainerSnapshot(db);
  if (!snapshot) return;
  const deadline = automaticDeadline(snapshot);
  if (deadline !== null && deadline <= now) await db.runAsync(
    "INSERT INTO retainer_wear_punches(retainer_period_id,status,timestamp,origin) VALUES (?,'OUT',?,'automatic')",
    snapshot.period.id, deadline,
  );
}
export async function reconcileAutomaticOut(db: SQLiteDatabase, now = Date.now()) {
  await withUserMutationTransaction(db, (tx) => reconcileInTransaction(tx, now));
}
export async function saveRetainerSettings(db: SQLiteDatabase, settings: RetainerSettings, now = Date.now()) {
  await withUserMutationTransaction(db, async (tx) => {
    if ((await getTrackingMode(tx)).kind !== 'retainer') throw new Error('Retainer Mode is not active.');
    const previous = await getRetainerSettings(tx);
    const changed = previous.automatic_enabled !== settings.automatic_enabled || previous.automatic_minutes !== settings.automatic_minutes;
    await tx.runAsync(`UPDATE retainer_settings SET bedtime_enabled=?, bedtime_minutes=?, morning_enabled=?, morning_minutes=?, automatic_enabled=?, automatic_minutes=?, automatic_effective_at=? WHERE id=1`,
      settings.bedtime_enabled, settings.bedtime_minutes, settings.morning_enabled, settings.morning_minutes,
      settings.automatic_enabled, settings.automatic_minutes, changed ? now : previous.automatic_effective_at);
  });
  notifyTrackingChanged();
}
export async function enableRetainerMode(db: SQLiteDatabase, now = Date.now()) {
  await withUserMutationTransaction(db, async (tx) => {
    const mode = await getTrackingMode(tx);
    if (mode.kind !== 'treatment') throw new Error('An active treatment is required.');
    const tray = await tx.getFirstAsync<{ id: number; started_at: number }>('SELECT id, started_at FROM tray_periods WHERE treatment_id=? AND ended_at IS NULL', mode.treatmentId);
    if (!tray || now < tray.started_at) throw new Error('Active tray unavailable.');
    const punch = await tx.getFirstAsync<{ status: WearStatus; timestamp: number }>('SELECT status,timestamp FROM wear_punches WHERE tray_period_id=? ORDER BY timestamp DESC,id DESC LIMIT 1', tray.id);
    if (!punch || punch.timestamp > now) throw new Error('Invalid treatment timeline.');
    if (punch.status === 'IN') await tx.runAsync("INSERT INTO wear_punches(tray_period_id,status,timestamp) VALUES (?,'OUT',?)", tray.id, now);
    await tx.runAsync('UPDATE tray_periods SET ended_at=? WHERE id=?', now, tray.id);
    await tx.runAsync('UPDATE treatments SET completed_at=? WHERE id=?', now, mode.treatmentId);
    const period = await tx.runAsync('INSERT INTO retainer_periods(treatment_id,started_at) VALUES (?,?)', mode.treatmentId, now);
    await tx.runAsync("INSERT INTO retainer_wear_punches(retainer_period_id,status,timestamp,origin) VALUES (?,'OUT',?,'lifecycle')", period.lastInsertRowId, now);
  });
  notifyTrackingChanged();
}
export async function disableRetainerMode(db: SQLiteDatabase, now = Date.now()) {
  await withUserMutationTransaction(db, async (tx) => {
    await reconcileInTransaction(tx, now);
    const snapshot = await getRetainerSnapshot(tx);
    if (!snapshot || snapshot.punches[0].timestamp > now) throw new Error('Retainer state changed.');
    if (snapshot.punches[0].status === 'IN') await tx.runAsync("INSERT INTO retainer_wear_punches(retainer_period_id,status,timestamp,origin) VALUES (?,'OUT',?,'lifecycle')", snapshot.period.id, now);
    await tx.runAsync('UPDATE retainer_periods SET ended_at=? WHERE id=?', now, snapshot.period.id);
  });
  notifyTrackingChanged();
}
export async function toggleRetainers(db: SQLiteDatabase, expectedId: number, now = Date.now()) {
  await withUserMutationTransaction(db, async (tx) => {
    const before = await getRetainerSnapshot(tx);
    if (!before || before.punches[0]?.id !== expectedId) throw new Error('Retainer state changed. Please try again.');
    await reconcileInTransaction(tx, now);
    const snapshot = await getRetainerSnapshot(tx);
    if (!snapshot) throw new Error('Retainer Mode is not active.');
    const latest = snapshot.punches[0];
    // A due assumed OUT satisfies a tap to remove, rather than toggling back IN.
    if (latest.id !== expectedId) return;
    if (now <= latest.timestamp) throw new Error('Please try again after the last recorded time.');
    await tx.runAsync("INSERT INTO retainer_wear_punches(retainer_period_id,status,timestamp) VALUES (?,?,?)", snapshot.period.id, latest.status === 'IN' ? 'OUT' : 'IN', now);
  });
  notifyTrackingChanged();
}
