import type { SQLiteDatabase } from 'expo-sqlite';

import {
  BACKUP_SNAPSHOT_SCHEMA_VERSION,
  type BackupSnapshotEnvelopeV1,
  BackupSnapshotValidationError,
  serializeBackupSnapshot,
  validateBackupSnapshotEnvelope,
} from '@/features/cloud-backup/backup-snapshot';

jest.mock('expo-crypto', () => {
  const nodeCrypto = jest.requireActual('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { HEX: 'hex' },
    digestStringAsync: jest.fn(async (_algorithm: string, value: string) =>
      nodeCrypto.createHash('sha256').update(value).digest('hex'),
    ),
  };
});

type SnapshotFixture = {
  treatments: { id: number; created_at: number; local_only_note?: string }[];
  treatmentPlanVersions: {
    id: number;
    treatment_id: number;
    total_trays: number;
    days_per_tray: number;
    daily_wear_goal_minutes: number;
    effective_at: number;
    created_at: number;
  }[];
  trayPeriods: {
    id: number;
    treatment_id: number;
    tray_number: number;
    started_at: number;
    ended_at: number | null;
  }[];
  wearPunches: {
    id: number;
    tray_period_id: number;
    status: 'IN' | 'OUT';
    timestamp: number;
    scheduled_notification_id?: string;
  }[];
  settings: {
    out_reminder_enabled: number;
    out_reminder_minutes: number;
    out_persistent_reminder_interval_minutes: number;
    tray_change_reminder_enabled: number;
    tray_change_reminder_hour: number;
    tray_change_reminder_minute: number;
    notifications_enabled?: number;
    auth_token?: string;
  } | null;
};

const BASE_FIXTURE: SnapshotFixture = {
  treatments: [{ id: 7, created_at: 1_700_000_000_000 }],
  treatmentPlanVersions: [
    {
      id: 12,
      treatment_id: 7,
      total_trays: 32,
      days_per_tray: 10,
      daily_wear_goal_minutes: 1_320,
      effective_at: 1_702_000_000_000,
      created_at: 1_702_000_000_000,
    },
    {
      id: 11,
      treatment_id: 7,
      total_trays: 28,
      days_per_tray: 14,
      daily_wear_goal_minutes: 1_300,
      effective_at: 1_700_000_000_000,
      created_at: 1_700_000_000_000,
    },
  ],
  trayPeriods: [
    {
      id: 23,
      treatment_id: 7,
      tray_number: 1,
      started_at: 1_704_000_000_000,
      ended_at: null,
    },
    {
      id: 21,
      treatment_id: 7,
      tray_number: 1,
      started_at: 1_700_000_000_000,
      ended_at: 1_702_000_000_000,
    },
    {
      id: 22,
      treatment_id: 7,
      tray_number: 2,
      started_at: 1_702_000_000_000,
      ended_at: 1_704_000_000_000,
    },
  ],
  wearPunches: [
    {
      id: 33,
      tray_period_id: 22,
      status: 'OUT',
      timestamp: 1_703_100_000_000,
    },
    {
      id: 31,
      tray_period_id: 21,
      status: 'IN',
      timestamp: 1_700_000_000_000,
    },
    {
      id: 34,
      tray_period_id: 23,
      status: 'IN',
      timestamp: 1_704_000_000_000,
    },
    {
      id: 32,
      tray_period_id: 22,
      status: 'IN',
      timestamp: 1_702_000_000_000,
    },
  ],
  settings: {
    out_reminder_enabled: 1,
    out_reminder_minutes: 60,
    out_persistent_reminder_interval_minutes: 10,
    tray_change_reminder_enabled: 0,
    tray_change_reminder_hour: 18,
    tray_change_reminder_minute: 30,
  },
};

function cloneFixture(fixture: SnapshotFixture): SnapshotFixture {
  return {
    treatments: fixture.treatments.map((row) => ({ ...row })),
    treatmentPlanVersions: fixture.treatmentPlanVersions.map((row) => ({ ...row })),
    trayPeriods: fixture.trayPeriods.map((row) => ({ ...row })),
    wearPunches: fixture.wearPunches.map((row) => ({ ...row })),
    settings: fixture.settings === null ? null : { ...fixture.settings },
  };
}

function createSnapshotDatabase(fixture: SnapshotFixture, reverseResults = false) {
  const parentGetAllAsync = jest.fn(async () => {
    throw new Error('Snapshot reads must use the exclusive transaction.');
  });
  const parentGetFirstAsync = jest.fn(async () => {
    throw new Error('Snapshot reads must use the exclusive transaction.');
  });
  const transactionQueries: string[] = [];
  const withExclusiveTransactionAsync = jest.fn(
    async (task: (transaction: SQLiteDatabase) => Promise<void>) => {
      const snapshot = cloneFixture(fixture);
      const order = <T,>(rows: T[]) =>
        reverseResults ? [...rows].reverse() : [...rows];
      const getAllAsync = jest.fn(async (sql: string) => {
        transactionQueries.push(sql);
        if (sql.includes('FROM treatment_plan_versions')) {
          return order(snapshot.treatmentPlanVersions);
        }
        if (sql.includes('FROM tray_periods')) return order(snapshot.trayPeriods);
        if (sql.includes('FROM wear_punches')) return order(snapshot.wearPunches);
        if (sql.includes('FROM treatments')) return order(snapshot.treatments);
        throw new Error(`Unexpected snapshot query: ${sql}`);
      });
      const getFirstAsync = jest.fn(async (sql: string) => {
        transactionQueries.push(sql);
        if (sql.includes('FROM settings')) {
          return snapshot.settings === null ? null : { ...snapshot.settings };
        }
        throw new Error(`Unexpected snapshot query: ${sql}`);
      });
      await task({ getAllAsync, getFirstAsync } as unknown as SQLiteDatabase);
    },
  );

  return {
    db: {
      getAllAsync: parentGetAllAsync,
      getFirstAsync: parentGetFirstAsync,
      withExclusiveTransactionAsync,
    } as unknown as SQLiteDatabase,
    parentGetAllAsync,
    parentGetFirstAsync,
    transactionQueries,
    withExclusiveTransactionAsync,
  };
}

function parseSnapshot(json: string) {
  return JSON.parse(json) as BackupSnapshotEnvelopeV1;
}

describe('backup snapshot serialization', () => {
  it('reads authoritative fields in one exclusive transaction and returns Phase 2A metadata', async () => {
    const fixture = cloneFixture(BASE_FIXTURE);
    fixture.treatments[0].local_only_note = 'not part of the logical format';
    fixture.wearPunches[0].scheduled_notification_id = 'transient-notification';
    if (fixture.settings) {
      fixture.settings.notifications_enabled = 1;
      fixture.settings.auth_token = 'secret';
    }
    const database = createSnapshotDatabase(fixture);

    const snapshot = await serializeBackupSnapshot(database.db, {
      sourceAppVersion: '1.0.0-β',
    });
    const envelope = parseSnapshot(snapshot.json);

    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.parentGetAllAsync).not.toHaveBeenCalled();
    expect(database.parentGetFirstAsync).not.toHaveBeenCalled();
    expect(database.transactionQueries).toHaveLength(5);
    expect(database.transactionQueries.every((sql) => !sql.includes('SELECT *'))).toBe(true);
    expect(database.transactionQueries.join('\n')).not.toContain('app_installation');
    expect(database.transactionQueries.join('\n')).not.toContain('notifications_enabled');
    expect(envelope).toEqual({
      schemaVersion: 1,
      sourceAppVersion: '1.0.0-β',
      payload: {
        treatments: [{ id: 7, createdAt: 1_700_000_000_000 }],
        treatmentPlanVersions: [
          {
            id: 11,
            treatmentId: 7,
            totalTrays: 28,
            daysPerTray: 14,
            dailyWearGoalMinutes: 1_300,
            effectiveAt: 1_700_000_000_000,
            createdAt: 1_700_000_000_000,
          },
          {
            id: 12,
            treatmentId: 7,
            totalTrays: 32,
            daysPerTray: 10,
            dailyWearGoalMinutes: 1_320,
            effectiveAt: 1_702_000_000_000,
            createdAt: 1_702_000_000_000,
          },
        ],
        trayPeriods: [
          {
            id: 21,
            treatmentId: 7,
            trayNumber: 1,
            startedAt: 1_700_000_000_000,
            endedAt: 1_702_000_000_000,
          },
          {
            id: 22,
            treatmentId: 7,
            trayNumber: 2,
            startedAt: 1_702_000_000_000,
            endedAt: 1_704_000_000_000,
          },
          {
            id: 23,
            treatmentId: 7,
            trayNumber: 1,
            startedAt: 1_704_000_000_000,
            endedAt: null,
          },
        ],
        wearPunches: [
          {
            id: 31,
            trayPeriodId: 21,
            status: 'IN',
            timestamp: 1_700_000_000_000,
          },
          {
            id: 32,
            trayPeriodId: 22,
            status: 'IN',
            timestamp: 1_702_000_000_000,
          },
          {
            id: 33,
            trayPeriodId: 22,
            status: 'OUT',
            timestamp: 1_703_100_000_000,
          },
          {
            id: 34,
            trayPeriodId: 23,
            status: 'IN',
            timestamp: 1_704_000_000_000,
          },
        ],
        notificationSettings: {
          outReminderEnabled: true,
          outReminderMinutes: 60,
          outPersistentReminderIntervalMinutes: 10,
          trayChangeReminderEnabled: false,
          trayChangeReminderHour: 18,
          trayChangeReminderMinute: 30,
        },
      },
    });
    expect(snapshot).toMatchObject({
      schemaVersion: BACKUP_SNAPSHOT_SCHEMA_VERSION,
      sourceAppVersion: '1.0.0-β',
      contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(snapshot.payloadBytes).toBe(new TextEncoder().encode(snapshot.json).byteLength);
    expect(snapshot.json).not.toMatch(
      /local_only_note|scheduled_notification_id|notifications_enabled|auth_token|secret/,
    );
  });

  it('canonicalizes database return order to byte-identical JSON and hashes', async () => {
    const ordered = await serializeBackupSnapshot(createSnapshotDatabase(BASE_FIXTURE).db, {
      sourceAppVersion: '1.0.0',
    });
    const reversed = await serializeBackupSnapshot(
      createSnapshotDatabase(BASE_FIXTURE, true).db,
      { sourceAppVersion: '1.0.0' },
    );
    const repeated = await serializeBackupSnapshot(createSnapshotDatabase(BASE_FIXTURE).db, {
      sourceAppVersion: '1.0.0',
    });

    expect(reversed).toEqual(ordered);
    expect(repeated).toEqual(ordered);
  });

  it('excludes app version from change detection while retaining it in the envelope', async () => {
    const first = await serializeBackupSnapshot(createSnapshotDatabase(BASE_FIXTURE).db, {
      sourceAppVersion: '1.0.0',
    });
    const next = await serializeBackupSnapshot(createSnapshotDatabase(BASE_FIXTURE).db, {
      sourceAppVersion: '2.0.0',
    });

    expect(next.contentHash).toBe(first.contentHash);
    expect(next.json).not.toBe(first.json);
    expect(parseSnapshot(next.json).sourceAppVersion).toBe('2.0.0');
  });

  it.each([
    ['plan version', (fixture: SnapshotFixture) => (fixture.treatmentPlanVersions[0].days_per_tray = 9)],
    ['tray period', (fixture: SnapshotFixture) => (fixture.trayPeriods[0].tray_number = 4)],
    ['corrected punch', (fixture: SnapshotFixture) => (fixture.wearPunches[0].timestamp += 60_000)],
    ['notification setting', (fixture: SnapshotFixture) => {
      if (fixture.settings) fixture.settings.out_reminder_minutes = 75;
    }],
  ])('changes the content hash when authoritative %s data changes', async (_name, change) => {
    const changedFixture = cloneFixture(BASE_FIXTURE);
    change(changedFixture);
    const original = await serializeBackupSnapshot(createSnapshotDatabase(BASE_FIXTURE).db, {
      sourceAppVersion: '1.0.0',
    });
    const changed = await serializeBackupSnapshot(createSnapshotDatabase(changedFixture).db, {
      sourceAppVersion: '1.0.0',
    });

    expect(changed.contentHash).not.toBe(original.contentHash);
  });

  it('serializes an empty installation with its persisted default settings', async () => {
    const fixture = cloneFixture(BASE_FIXTURE);
    fixture.treatments = [];
    fixture.treatmentPlanVersions = [];
    fixture.trayPeriods = [];
    fixture.wearPunches = [];
    fixture.settings = {
      out_reminder_enabled: 1,
      out_reminder_minutes: 45,
      out_persistent_reminder_interval_minutes: 5,
      tray_change_reminder_enabled: 1,
      tray_change_reminder_hour: 9,
      tray_change_reminder_minute: 0,
    };

    const snapshot = await serializeBackupSnapshot(createSnapshotDatabase(fixture).db, {
      sourceAppVersion: '1.0.0',
    });

    expect(parseSnapshot(snapshot.json).payload).toEqual({
      treatments: [],
      treatmentPlanVersions: [],
      trayPeriods: [],
      wearPunches: [],
      notificationSettings: {
        outReminderEnabled: true,
        outReminderMinutes: 45,
        outPersistentReminderIntervalMinutes: 5,
        trayChangeReminderEnabled: true,
        trayChangeReminderHour: 9,
        trayChangeReminderMinute: 0,
      },
    });
  });

  it('rejects a missing settings singleton', async () => {
    const fixture = cloneFixture(BASE_FIXTURE);
    fixture.settings = null;

    await expect(
      serializeBackupSnapshot(createSnapshotDatabase(fixture).db, {
        sourceAppVersion: '1.0.0',
      }),
    ).rejects.toThrow('Snapshot notification settings are missing.');
  });
});

describe('backup snapshot validation', () => {
  let validEnvelope: BackupSnapshotEnvelopeV1;

  beforeAll(async () => {
    const snapshot = await serializeBackupSnapshot(createSnapshotDatabase(BASE_FIXTURE).db, {
      sourceAppVersion: '1.0.0',
    });
    validEnvelope = parseSnapshot(snapshot.json);
  });

  it('accepts the current schema and rejects an unsupported schema version', () => {
    expect(validateBackupSnapshotEnvelope(validEnvelope)).toEqual(validEnvelope);
    expect(() =>
      validateBackupSnapshotEnvelope({ ...validEnvelope, schemaVersion: 2 }),
    ).toThrow(BackupSnapshotValidationError);
  });

  it('rejects blank app versions and unexpected envelope data', () => {
    expect(() =>
      validateBackupSnapshotEnvelope({ ...validEnvelope, sourceAppVersion: '   ' }),
    ).toThrow('snapshot.sourceAppVersion must not be blank');
    expect(() =>
      validateBackupSnapshotEnvelope({ ...validEnvelope, snapshotId: 'volatile-id' }),
    ).toThrow('snapshot must contain exactly');
  });

  it('rejects invalid values and duplicate stable identifiers', () => {
    const invalidPlan = {
      ...validEnvelope,
      payload: {
        ...validEnvelope.payload,
        treatmentPlanVersions: validEnvelope.payload.treatmentPlanVersions.map((version, index) =>
          index === 0 ? { ...version, dailyWearGoalMinutes: 1_441 } : version,
        ),
      },
    };
    const invalidPunch = {
      ...validEnvelope,
      payload: {
        ...validEnvelope.payload,
        wearPunches: validEnvelope.payload.wearPunches.map((punch, index) =>
          index === 0 ? { ...punch, status: 'PAUSED' } : punch,
        ),
      },
    };
    const duplicateTreatment = {
      ...validEnvelope,
      payload: {
        ...validEnvelope.payload,
        treatments: [
          ...validEnvelope.payload.treatments,
          { ...validEnvelope.payload.treatments[0] },
        ],
      },
    };

    expect(() => validateBackupSnapshotEnvelope(invalidPlan)).toThrow(
      'dailyWearGoalMinutes must be between 0 and 1440',
    );
    expect(() => validateBackupSnapshotEnvelope(invalidPunch)).toThrow("must be 'IN' or 'OUT'");
    expect(() => validateBackupSnapshotEnvelope(duplicateTreatment)).toThrow(
      'must not contain duplicate id',
    );
  });

  it('rejects broken treatment and tray-period relationships', () => {
    const missingTreatment = {
      ...validEnvelope,
      payload: {
        ...validEnvelope.payload,
        treatmentPlanVersions: validEnvelope.payload.treatmentPlanVersions.map(
          (version, index) => (index === 0 ? { ...version, treatmentId: 999 } : version),
        ),
      },
    };
    const missingTrayPeriod = {
      ...validEnvelope,
      payload: {
        ...validEnvelope.payload,
        wearPunches: validEnvelope.payload.wearPunches.map((punch, index) =>
          index === 0 ? { ...punch, trayPeriodId: 999 } : punch,
        ),
      },
    };

    expect(() => validateBackupSnapshotEnvelope(missingTreatment)).toThrow(
      'references missing treatment 999',
    );
    expect(() => validateBackupSnapshotEnvelope(missingTrayPeriod)).toThrow(
      'references missing tray period 999',
    );
  });
});

function createMatureTreatmentFixture(): SnapshotFixture {
  const dayMilliseconds = 24 * 60 * 60 * 1_000;
  const start = Date.UTC(2025, 0, 1);
  const trayPeriods = Array.from({ length: 27 }, (_, index) => ({
    id: 2_000 + index,
    treatment_id: 1,
    tray_number: (index % 18) + 1,
    started_at: start + index * 14 * dayMilliseconds,
    ended_at: index === 26 ? null : start + (index + 1) * 14 * dayMilliseconds,
  }));
  let punchId = 10_000;
  const wearPunches: SnapshotFixture['wearPunches'] = [];
  const transitionHours = [7, 12, 18, 22];
  for (let day = 0; day < 365; day += 1) {
    for (const [index, hour] of transitionHours.entries()) {
      const correctionOffset = day === 120 && index === 1 ? 15 * 60 * 1_000 : 0;
      wearPunches.push({
        id: punchId,
        tray_period_id: 2_000 + Math.floor(day / 14),
        status: index % 2 === 0 ? 'IN' : 'OUT',
        timestamp: start + day * dayMilliseconds + hour * 60 * 60 * 1_000 + correctionOffset,
      });
      punchId += 1;
    }
  }
  wearPunches.push(
    {
      id: punchId,
      tray_period_id: 2_000 + Math.floor(200 / 14),
      status: 'IN',
      timestamp: start + 200 * dayMilliseconds + 2 * 60 * 60 * 1_000,
    },
    {
      id: punchId + 1,
      tray_period_id: 2_000 + Math.floor(200 / 14),
      status: 'OUT',
      timestamp: start + 200 * dayMilliseconds + 3 * 60 * 60 * 1_000,
    },
  );

  return {
    treatments: [{ id: 1, created_at: start }],
    treatmentPlanVersions: [
      {
        id: 101,
        treatment_id: 1,
        total_trays: 40,
        days_per_tray: 14,
        daily_wear_goal_minutes: 1_320,
        effective_at: start,
        created_at: start,
      },
      {
        id: 102,
        treatment_id: 1,
        total_trays: 42,
        days_per_tray: 12,
        daily_wear_goal_minutes: 1_300,
        effective_at: start + 120 * dayMilliseconds,
        created_at: start + 120 * dayMilliseconds,
      },
      {
        id: 103,
        treatment_id: 1,
        total_trays: 45,
        days_per_tray: 10,
        daily_wear_goal_minutes: 1_340,
        effective_at: start + 240 * dayMilliseconds,
        created_at: start + 240 * dayMilliseconds,
      },
    ],
    trayPeriods,
    wearPunches,
    settings: {
      out_reminder_enabled: 1,
      out_reminder_minutes: 75,
      out_persistent_reminder_interval_minutes: 15,
      tray_change_reminder_enabled: 1,
      tray_change_reminder_hour: 8,
      tray_change_reminder_minute: 30,
    },
  };
}

describe('mature treatment snapshot measurement', () => {
  it('generates a 12-month payload beneath the Storage object limit and records timing', async () => {
    const fixture = createMatureTreatmentFixture();
    const durations: number[] = [];
    let payloadBytes = 0;

    for (let run = 0; run < 12; run += 1) {
      const startedAt = performance.now();
      const snapshot = await serializeBackupSnapshot(createSnapshotDatabase(fixture).db, {
        sourceAppVersion: '1.0.0',
      });
      if (run >= 2) durations.push(performance.now() - startedAt);
      payloadBytes = snapshot.payloadBytes;
    }

    const orderedDurations = durations.toSorted((left, right) => left - right);
    const median = orderedDurations[Math.floor(orderedDurations.length / 2)];
    const p95 = orderedDurations[Math.ceil(orderedDurations.length * 0.95) - 1];
    console.info(
      `Mature snapshot: ${payloadBytes} bytes, median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`,
    );

    const envelope = parseSnapshot(
      (
        await serializeBackupSnapshot(createSnapshotDatabase(fixture).db, {
          sourceAppVersion: '1.0.0',
        })
      ).json,
    );
    expect(envelope.payload.treatmentPlanVersions).toHaveLength(3);
    expect(envelope.payload.trayPeriods).toHaveLength(27);
    expect(envelope.payload.wearPunches).toHaveLength(1_462);
    expect(new Set(envelope.payload.trayPeriods.map(({ trayNumber }) => trayNumber)).size).toBe(
      18,
    );
    expect(payloadBytes).toBeLessThan(50 * 1024 * 1024);
    expect(median).toBeGreaterThanOrEqual(0);
    expect(p95).toBeGreaterThanOrEqual(median);
  });
});
