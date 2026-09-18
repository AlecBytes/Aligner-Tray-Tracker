import type { SQLiteDatabase } from 'expo-sqlite';
import { withUserMutationTransaction, type SQLiteMutationTransaction } from '@/db/mutation-transaction';
import { planMissingWearPeriod, planWearPunchDeletion, validateEditedPunchTimestamp } from '@/features/edit-times/edit-times-corrections';
import type { EditableWearPunch, MissingPeriodInput, WearPunchDeletionPlan } from '@/features/edit-times/edit-times-model';
import { CorrectionConflictError } from '@/features/edit-times/edit-times-repository';
import { notifyTrackingChanged, type RetainerPeriod, type RetainerPunch } from './retainer-repository';
const map = (punch: RetainerPunch): EditableWearPunch => ({ id: punch.id, timestamp: punch.timestamp, status: punch.status, trayPeriodId: punch.retainer_period_id });
export function retainerCorrections(periodId: number) {
  async function load(db: Pick<SQLiteMutationTransaction, 'getFirstAsync' | 'getAllAsync'>) {
    const row = await db.getFirstAsync<RetainerPeriod>('SELECT * FROM retainer_periods WHERE id=? AND ended_at IS NULL', periodId);
    if (!row) throw new CorrectionConflictError();
    const rows = await db.getAllAsync<RetainerPunch>('SELECT * FROM retainer_wear_punches WHERE retainer_period_id=? ORDER BY timestamp,id', periodId);
    return { period: { id: row.id, startedAt: row.started_at, endedAt: row.ended_at }, punches: rows.map(map) };
  }
  async function suppress(db: SQLiteMutationTransaction, timestamp: number) {
    await db.runAsync(`UPDATE retainer_wear_punches SET auto_out_suppressed=1 WHERE id=(SELECT id FROM retainer_wear_punches WHERE retainer_period_id=? AND status='IN' AND timestamp<=? ORDER BY timestamp DESC,id DESC LIMIT 1)`, periodId, timestamp);
  }
  return {
    async getTreatmentHistoryStart(db: SQLiteDatabase) { return (await load(db)).period.startedAt; },
    async getWearPunchesForDay(db: SQLiteDatabase, start: number, end: number) { return (await load(db)).punches.filter((p) => p.timestamp >= start && p.timestamp < end); },
    async getWearPunchForEdit(db: SQLiteDatabase, id: number) {
      const { period, punches } = await load(db); const punch = punches.find((p) => p.id === id);
      if (!punch) return null;
      return { period, punch, deletionPlan: punches[0].id === id ? null : planWearPunchDeletion(period, punches, id) };
    },
    async updateWearPunchTimestamp(db: SQLiteDatabase, id: number, timestamp: number, expectedPunch?: EditableWearPunch) {
      let result: EditableWearPunch | null = null;
      await withUserMutationTransaction(db, async (tx) => {
        const { period, punches } = await load(tx); const punch = punches.find((p) => p.id === id);
        if (!punch || (expectedPunch && (punch.timestamp !== expectedPunch.timestamp || punch.status !== expectedPunch.status || punch.trayPeriodId !== expectedPunch.trayPeriodId)) || punches[0].id === id || timestamp > Date.now()) throw new CorrectionConflictError();
        validateEditedPunchTimestamp(period, punches, id, timestamp);
        await suppress(tx, punch.timestamp);
        await tx.runAsync("UPDATE retainer_wear_punches SET timestamp=?, origin='correction', auto_out_suppressed=1 WHERE id=? AND retainer_period_id=?", timestamp, id, periodId);
        result = { ...punch, timestamp };
      }); notifyTrackingChanged(); return result!;
    },
    async deleteWearPunch(db: SQLiteDatabase, expected: WearPunchDeletionPlan) {
      let deleted: EditableWearPunch[] = [];
      await withUserMutationTransaction(db, async (tx) => {
        const { period, punches } = await load(tx); const plan = planWearPunchDeletion(period, punches, expected.selectedPunch.id);
        if (JSON.stringify(plan) !== JSON.stringify(expected)) throw new CorrectionConflictError();
        await suppress(tx, plan.selectedPunch.timestamp);
        for (const punch of plan.punchesToDelete) await tx.runAsync('DELETE FROM retainer_wear_punches WHERE id=? AND retainer_period_id=?', punch.id, periodId);
        deleted = plan.punchesToDelete;
      }); notifyTrackingChanged(); return deleted;
    },
    async addMissingWearPeriod(db: SQLiteDatabase, input: MissingPeriodInput) {
      const result: EditableWearPunch[] = [];
      await withUserMutationTransaction(db, async (tx) => {
        const { period, punches } = await load(tx);
        if (input.endTimestamp > Date.now()) throw new CorrectionConflictError();
        const planned = planMissingWearPeriod(period, punches, input);
        await suppress(tx, input.startTimestamp);
        for (const punch of planned) {
          const inserted = await tx.runAsync("INSERT INTO retainer_wear_punches(retainer_period_id,status,timestamp,origin,auto_out_suppressed) VALUES (?,?,?,'correction',1)", periodId, punch.status, punch.timestamp);
          result.push({ ...punch, id: inserted.lastInsertRowId, trayPeriodId: periodId });
        }
      }); notifyTrackingChanged(); return result;
    },
  };
}
