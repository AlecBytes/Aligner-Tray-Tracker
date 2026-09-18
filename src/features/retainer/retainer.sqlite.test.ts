import { setRetainerHistory, validateRetainerHistory } from './retainer-history-session';
import { createRetainerTrackerModel } from './retainer-tracker-model';
import { serializeBackupSnapshot, validateBackupSnapshotEnvelope } from '@/features/cloud-backup/backup-snapshot';
import { validateRestorableBackupSnapshotV1 } from '@/features/cloud-backup/restore-snapshot';
import { importBackupSnapshot, isCloudRestoreEligible } from '@/features/cloud-backup/restore-repository';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrateDatabase } from '@/db/migrations';
import { createInitialTreatment } from '@/features/treatment/treatment-repository';
import { redoRetainerToggle, undoRetainerToggle, automaticDeadline, disableRetainerMode, enableRetainerMode, getRetainerSnapshot, getTrackingMode, reconcileAutomaticOut, saveRetainerSettings, toggleRetainers } from './retainer-repository';
import { retainerCorrections } from './retainer-corrections';
import { buildRetainerReminders } from './retainer-notifications';
jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'sha256' }, CryptoEncoding: { HEX: 'hex' }, digestStringAsync: async (_: string, text: string) => jest.requireActual('node:crypto').createHash('sha256').update(text).digest('hex') }));
const { DatabaseSync } = jest.requireActual('node:sqlite');
function database() {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    prepareAsync: async (sql: string) => ({ executeAsync: async (params: unknown[]) => { const r = sqlite.prepare(sql).run(...params); return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) }; }, finalizeAsync: async () => undefined }),
    execAsync: async (sql: string) => sqlite.exec(sql),
    getFirstAsync: async (sql: string, ...params: unknown[]) => sqlite.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, ...params: unknown[]) => sqlite.prepare(sql).all(...params),
    runAsync: async (sql: string, ...params: unknown[]) => { const r = sqlite.prepare(sql).run(...params); return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) }; },
    withTransactionAsync: async (task: () => Promise<void>) => { sqlite.exec('BEGIN'); try { await task(); sqlite.exec('COMMIT'); } catch (e) { sqlite.exec('ROLLBACK'); throw e; } },
    withExclusiveTransactionAsync: async (task: (tx: unknown) => Promise<void>) => db.withTransactionAsync(() => task(db)),
  };
  return { db: db as unknown as SQLiteDatabase, close: () => sqlite.close() };
}
const setup = { totalTrays: 10, startingTrayNumber: 1, daysPerTray: 7, prescribedHoursPerDay: 22 };
const start = new Date(2026, 8, 1, 12).getTime();
const night = new Date(2026, 8, 1, 22).getTime();
const morning = new Date(2026, 8, 2, 7).getTime();
let fixture: ReturnType<typeof database>;
beforeEach(async () => { fixture = database(); await migrateDatabase(fixture.db); await createInitialTreatment(fixture.db, setup, start); });
afterEach(() => fixture.close());
it('closes treatment, starts OUT, preserves history and creates a new refinement treatment', async () => {
  const db = fixture.db; await enableRetainerMode(db, start + 1000);
  expect(await getTrackingMode(db)).toMatchObject({ kind: 'retainer', treatmentId: 1 });
  expect((await getRetainerSnapshot(db))?.punches[0]).toMatchObject({ status: 'OUT', timestamp: start + 1000 });
  expect(await db.getFirstAsync('SELECT completed_at FROM treatments WHERE id=1')).toEqual({ completed_at: start + 1000 });
  await disableRetainerMode(db, start + 2000); expect(await getTrackingMode(db)).toEqual({ kind: 'setup' });
  await createInitialTreatment(db, setup, start + 3000);
  expect(await getTrackingMode(db)).toMatchObject({ kind: 'treatment', treatmentId: 2 });
  expect(await db.getFirstAsync('SELECT count(*) AS n FROM treatments')).toEqual({ n: 2 });
});
it('reconciles exactly one assumed OUT at the cutoff and retains the morning reminder', async () => {
  const db = fixture.db; await enableRetainerMode(db, start + 1000);
  let snapshot = (await getRetainerSnapshot(db))!;
  await saveRetainerSettings(db, { ...snapshot.settings, automatic_enabled: 1, morning_minutes: 480 }, start + 2000);
  await toggleRetainers(db, snapshot.punches[0].id, night);
  snapshot = (await getRetainerSnapshot(db))!;
  expect(automaticDeadline(snapshot)).toBe(morning);
  await reconcileAutomaticOut(db, morning + 1000); await reconcileAutomaticOut(db, morning + 2000);
  snapshot = (await getRetainerSnapshot(db))!;
  expect(snapshot.punches[0]).toMatchObject({ timestamp: morning, origin: 'automatic' });
  expect(buildRetainerReminders(snapshot, morning + 2000).filter((r) => r.kind === 'retainer-morning')).toHaveLength(1);
  expect(await db.getFirstAsync("SELECT count(*) AS n FROM retainer_wear_punches WHERE origin='automatic'")).toEqual({ n: 1 });
});
it('manual deletion of assumed OUT suppresses automation across reloads', async () => {
  const db = fixture.db; await enableRetainerMode(db, start + 1000); let snapshot = (await getRetainerSnapshot(db))!;
  await saveRetainerSettings(db, { ...snapshot.settings, automatic_enabled: 1 }, start + 2000);
  await toggleRetainers(db, snapshot.punches[0].id, night); await reconcileAutomaticOut(db, morning);
  snapshot = (await getRetainerSnapshot(db))!;
  const corrections = retainerCorrections(snapshot.period.id);
  const event = (await corrections.getWearPunchForEdit(db, snapshot.punches[0].id))!;
  await corrections.deleteWearPunch(db, event.deletionPlan!); await reconcileAutomaticOut(db, morning + 86400000);
  expect((await getRetainerSnapshot(db))?.punches[0]).toMatchObject({ status: 'IN', auto_out_suppressed: 1 });
});
it('settings apply prospectively and manual OUT wins', async () => {
  const db = fixture.db; await enableRetainerMode(db, start + 1000); let snapshot = (await getRetainerSnapshot(db))!;
  await toggleRetainers(db, snapshot.punches[0].id, night);
  await saveRetainerSettings(db, { ...snapshot.settings, automatic_enabled: 1 }, morning + 1000);
  snapshot = (await getRetainerSnapshot(db))!;
  expect(automaticDeadline(snapshot)).toBe(new Date(2026,8,3,7).getTime());
  await toggleRetainers(db, snapshot.punches[0].id, morning + 2000); await reconcileAutomaticOut(db, morning + 86400000);
  expect((await getRetainerSnapshot(db))?.punches[0]).toMatchObject({ timestamp: morning + 2000, origin: 'manual' });
});
it('rejects stale toggles and conflicting lifecycle rows without partial writes', async () => {
  const db = fixture.db; await enableRetainerMode(db, start + 1000); const snapshot = (await getRetainerSnapshot(db))!;
  await expect(createInitialTreatment(db, setup, night)).rejects.toThrow();
  await expect(db.runAsync('INSERT INTO tray_periods(treatment_id,tray_number,started_at) VALUES (1,2,?)',night)).rejects.toThrow();
  await toggleRetainers(db, snapshot.punches[0].id, night);
  await expect(toggleRetainers(db, snapshot.punches[0].id, night + 1)).rejects.toThrow();
  expect((await getRetainerSnapshot(db))?.punches[0].status).toBe('IN');
});
it.each(['treatment','retainer','setup'] as const)('round trips V2 backup in %s mode with all history intact', async (kind) => {
  const db = fixture.db;
  if (kind !== 'treatment') await enableRetainerMode(db, start + 1000);
  if (kind === 'setup') await disableRetainerMode(db, start + 2000);
  const serialized = await serializeBackupSnapshot(db, { sourceAppVersion: 'test' });
  const envelope = validateRestorableBackupSnapshotV1(validateBackupSnapshotEnvelope(JSON.parse(serialized.json)));
  const target = database();
  try {
    await migrateDatabase(target.db); await importBackupSnapshot(target.db, envelope);
    expect((await getTrackingMode(target.db)).kind).toBe(kind);
    expect(await isCloudRestoreEligible(target.db)).toBe(false);
    expect((await serializeBackupSnapshot(target.db, { sourceAppVersion: 'test' })).contentHash).toBe(serialized.contentHash);
  } finally { target.close(); }
});
it('restores a V1 snapshot with default retention settings and no invented history', async () => {
  const current = JSON.parse((await serializeBackupSnapshot(fixture.db, { sourceAppVersion: 'test' })).json);
  delete current.payload.retainerData; current.schemaVersion = 1;
  for (const t of current.payload.treatments) delete t.completedAt;
  const envelope = validateRestorableBackupSnapshotV1(validateBackupSnapshotEnvelope(current));
  const target = database();
  try { await migrateDatabase(target.db); await importBackupSnapshot(target.db, envelope); expect(await getRetainerSnapshot(target.db)).toBeNull(); expect((await getTrackingMode(target.db)).kind).toBe('treatment'); }
  finally { target.close(); }
});
it('refinement backups preserve both courses and their retainer periods', async () => {
  const db = fixture.db; await enableRetainerMode(db,start+1000); await disableRetainerMode(db,start+2000); await createInitialTreatment(db,setup,start+3000);
  const envelope = validateRestorableBackupSnapshotV1(validateBackupSnapshotEnvelope(JSON.parse((await serializeBackupSnapshot(db,{sourceAppVersion:'test'})).json)));
  expect(envelope.payload.treatments).toHaveLength(2); expect(envelope.payload.retainerData?.periods).toHaveLength(1);
});
it('rejects a timestamp edit based on a stale event and protects the initial OUT anchor', async () => {
  const db = fixture.db; await enableRetainerMode(db,start+1000);
  const first = (await getRetainerSnapshot(db))!;
  await toggleRetainers(db,first.punches[0].id,night);
  const corrections = retainerCorrections(first.period.id);
  const snapshot = (await getRetainerSnapshot(db))!;
  const event = (await corrections.getWearPunchForEdit(db,snapshot.punches[0].id))!;
  await corrections.updateWearPunchTimestamp(db,event.punch.id,night+1000,event.punch);
  await expect(corrections.updateWearPunchTimestamp(db,event.punch.id,night+2000,event.punch)).rejects.toThrow();
  await expect(corrections.updateWearPunchTimestamp(db,first.punches[0].id,start+2000)).rejects.toThrow();
});
it('bounds future reminder scheduling and cancels obsolete requests without catch-up', async () => {
  const db = fixture.db; await enableRetainerMode(db,start+1000);
  let snapshot = (await getRetainerSnapshot(db))!;
  let requests = buildRetainerReminders(snapshot,night+1000);
  expect(requests).toHaveLength(14);
  expect(requests.every((r) => r.kind === 'retainer-bedtime' && r.scheduledAt > night+1000)).toBe(true);
  await toggleRetainers(db,snapshot.punches[0].id,night+2000);
  snapshot = (await getRetainerSnapshot(db))!;
  requests = buildRetainerReminders(snapshot,night+2000);
  expect(requests.every((r) => r.kind === 'retainer-morning')).toBe(true);
  await toggleRetainers(db,snapshot.punches[0].id,morning-1000);
  expect(buildRetainerReminders((await getRetainerSnapshot(db))!,morning).every((r) => r.kind === 'retainer-bedtime')).toBe(true);
});

it('undoes and redoes manual toggles with the original timestamp and isolated session history', async () => {
  const db = fixture.db;
  await enableRetainerMode(db, start + 1000);
  const initial = (await getRetainerSnapshot(db))!;
  const result = await toggleRetainers(db, initial.punches[0], night);
  expect(result.action).not.toBeNull();
  const action = result.action!;
  setRetainerHistory({ undoAction: action, redoAction: null });
  expect(validateRetainerHistory(result.snapshot).undoAction).toEqual(action);
  const undone = await undoRetainerToggle(db, action);
  setRetainerHistory({ undoAction: null, redoAction: action });
  expect(undone.punches[0]).toEqual(initial.punches[0]);
  expect(validateRetainerHistory(undone).redoAction).toEqual(action);
  const redone = await redoRetainerToggle(db, action);
  expect(redone.snapshot.punches[0]).toMatchObject({ timestamp: night, status: 'IN', origin: 'manual' });
  await expect(redoRetainerToggle(db, action)).rejects.toThrow('history changed');
  expect(validateRetainerHistory(redone.snapshot).redoAction).toBeNull();
});

it('suppresses automatic OUT on undo and restores the original suppression on redo', async () => {
  const db = fixture.db;
  await enableRetainerMode(db, start + 1000);
  const initial = (await getRetainerSnapshot(db))!;
  await saveRetainerSettings(db, { ...initial.settings, automatic_enabled: 1 }, start + 2000);
  const inside = await toggleRetainers(db, initial.punches[0], night);
  const outside = await toggleRetainers(db, inside.snapshot.punches[0], morning - 1000);
  const action = outside.action!;
  await undoRetainerToggle(db, action);
  await reconcileAutomaticOut(db, morning + 1000);
  expect((await getRetainerSnapshot(db))!.punches[0]).toMatchObject({ status: 'IN', auto_out_suppressed: 1 });
  const restored = await redoRetainerToggle(db, action);
  expect(restored.snapshot.punches[0]).toMatchObject({ status: 'OUT', timestamp: morning - 1000 });
  expect(restored.snapshot.punches[1].auto_out_suppressed).toBe(0);
});

it('returns automatic reconciliation without a manual action when the deadline wins a tap', async () => {
  const db = fixture.db;
  await enableRetainerMode(db, start + 1000);
  const initial = (await getRetainerSnapshot(db))!;
  await saveRetainerSettings(db, { ...initial.settings, automatic_enabled: 1 }, start + 2000);
  const inside = await toggleRetainers(db, initial.punches[0], night);
  setRetainerHistory({ undoAction: inside.action, redoAction: null });
  const result = await toggleRetainers(db, inside.snapshot.punches[0], morning + 1000);
  expect(result.action).toBeNull();
  expect(result.snapshot.punches[0]).toMatchObject({ status: 'OUT', origin: 'automatic', timestamp: morning });
  expect(validateRetainerHistory(result.snapshot).undoAction).toBeNull();
  await expect(undoRetainerToggle(db, inside.action!)).rejects.toThrow('history changed');
});

it('rejects corrections to the exact punch or predecessor and invalidates history on mode change', async () => {
  const db = fixture.db;
  await enableRetainerMode(db, start + 1000);
  const initial = (await getRetainerSnapshot(db))!;
  const inside = await toggleRetainers(db, initial.punches[0], night);
  const outside = await toggleRetainers(db, inside.snapshot.punches[0], morning);
  const correction = retainerCorrections(initial.period.id);
  await correction.updateWearPunchTimestamp(db, inside.snapshot.punches[0].id, night + 1000);
  await expect(undoRetainerToggle(db, outside.action!)).rejects.toThrow('history changed');
  setRetainerHistory({ undoAction: outside.action, redoAction: null });
  expect(validateRetainerHistory((await getRetainerSnapshot(db))!).undoAction).toBeNull();
  await correction.updateWearPunchTimestamp(db, outside.snapshot.punches[0].id, morning + 1000);
  await expect(toggleRetainers(db, outside.snapshot.punches[0], morning + 2000)).rejects.toThrow('state changed');
  await disableRetainerMode(db, morning + 3000);
  await expect(redoRetainerToggle(db, inside.action!)).rejects.toThrow('history changed');
  expect(validateRetainerHistory(null)).toEqual({ undoAction: null, redoAction: null });
});

it('rolls back the whole undo when its suppression update fails', async () => {
  const db = fixture.db;
  await enableRetainerMode(db, start + 1000);
  const initial = (await getRetainerSnapshot(db))!;
  const inside = await toggleRetainers(db, initial.punches[0], night);
  const outside = await toggleRetainers(db, inside.snapshot.punches[0], morning);
  await db.execAsync("CREATE TRIGGER fail_suppression BEFORE UPDATE ON retainer_wear_punches BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
  await expect(undoRetainerToggle(db, outside.action!)).rejects.toThrow('test failure');
  expect(await getRetainerSnapshot(db)).toEqual(outside.snapshot);
});

it('derives overnight wear and reminder information from the same notification policy', async () => {
  const db = fixture.db;
  await enableRetainerMode(db, start + 1000);
  const initial = (await getRetainerSnapshot(db))!;
  expect(createRetainerTrackerModel(initial, start + 2000).duration).toBe('No wear recorded');
  const inside = await toggleRetainers(db, initial.punches[0], night);
  expect(createRetainerTrackerModel(inside.snapshot, morning)).toMatchObject({ durationLabel: 'Current wear', duration: '09:00:00' });
  const outside = await toggleRetainers(db, inside.snapshot.punches[0], morning);
  expect(createRetainerTrackerModel(outside.snapshot, morning + 1000)).toMatchObject({ durationLabel: 'Last wear', duration: '09:00:00' });
  expect(createRetainerTrackerModel(outside.snapshot, morning + 1000).reminder).toContain('Bedtime reminder:');
  expect(createRetainerTrackerModel({ ...outside.snapshot, settings: { ...outside.snapshot.settings, bedtime_enabled: 0, morning_enabled: 0 } }, morning).reminder).toBe('Reminders off');
});
