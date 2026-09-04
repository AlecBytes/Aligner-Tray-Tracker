import {
  buildRecoveryPointCursorFilter,
  CloudRestoreOperationError,
  createRecoveryPointPage,
  RECOVERY_POINT_PAGE_SIZE,
  selectDefaultRecoveryPointId,
  validateRecoveryPointForUser,
  type RecoveryPointMetadataRow,
} from '@/features/cloud-backup/cloud-restore-core';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function snapshotId(value: number) {
  return `${value.toString(16).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
}

function row(
  id: string,
  createdAt = '2026-08-24T12:00:00.000Z',
  overrides: Partial<RecoveryPointMetadataRow> = {},
): RecoveryPointMetadataRow {
  return {
    app_version: '1.0.0',
    content_hash: 'a'.repeat(64),
    created_at: createdAt,
    id,
    payload_bytes: 512,
    schema_version: 1,
    storage_path: `${USER_ID}/${id}.json`,
    user_id: USER_ID,
    ...overrides,
  };
}

describe('cloud restore recovery-point metadata', () => {
  it('validates owned metadata and marks newer schemas unsupported', () => {
    const id = snapshotId(1);
    expect(validateRecoveryPointForUser(row(id), USER_ID)).toMatchObject({
      id,
      supported: true,
      userId: USER_ID,
    });
    expect(
      validateRecoveryPointForUser(row(id, undefined, { schema_version: 2 }), USER_ID),
    ).toMatchObject({ supported: false });
  });

  it.each([
    ['foreign user', { user_id: '22222222-2222-4222-8222-222222222222' }],
    ['wrong path', { storage_path: `${USER_ID}/other.json` }],
    ['bad timestamp', { created_at: 'yesterday' }],
    ['blank app version', { app_version: ' ' }],
    ['bad hash', { content_hash: 'abc' }],
    ['zero bytes', { payload_bytes: 0 }],
    ['oversized bytes', { payload_bytes: 50 * 1024 * 1024 + 1 }],
    ['invalid schema', { schema_version: 0 }],
  ])('rejects %s metadata', (_label, overrides) => {
    expect(() =>
      validateRecoveryPointForUser(row(snapshotId(1), undefined, overrides), USER_ID),
    ).toThrow(CloudRestoreOperationError);
  });

  it('returns pages of 25 and uses the final visible row as the next cursor', () => {
    const rows = Array.from({ length: RECOVERY_POINT_PAGE_SIZE + 1 }, (_, index) => {
      const descending = RECOVERY_POINT_PAGE_SIZE + 1 - index;
      return row(snapshotId(descending));
    });

    const page = createRecoveryPointPage(rows, USER_ID);
    expect(page.items).toHaveLength(RECOVERY_POINT_PAGE_SIZE);
    expect(page.nextCursor).toEqual({
      createdAt: page.items.at(-1)?.createdAt,
      id: snapshotId(2),
    });
  });

  it('rejects pages not ordered by created_at DESC, id DESC', () => {
    expect(() =>
      createRecoveryPointPage([row(snapshotId(1)), row(snapshotId(2))], USER_ID),
    ).toThrow(CloudRestoreOperationError);
  });

  it('builds a stable tied-timestamp keyset predicate from a validated cursor', () => {
    expect(
      buildRecoveryPointCursorFilter({
        createdAt: '2026-08-24T12:00:00.000Z',
        id: snapshotId(9),
      }),
    ).toBe(
      `created_at.lt."2026-08-24T12:00:00.000Z",and(created_at.eq."2026-08-24T12:00:00.000Z",id.lt.${snapshotId(9)})`,
    );
  });

  it('defaults to the newest supported recovery point', () => {
    const unsupported = validateRecoveryPointForUser(
      row(snapshotId(2), undefined, { schema_version: 2 }),
      USER_ID,
    );
    const supported = validateRecoveryPointForUser(row(snapshotId(1)), USER_ID);
    expect(selectDefaultRecoveryPointId([unsupported, supported])).toBe(supported.id);
    expect(selectDefaultRecoveryPointId([unsupported])).toBeNull();
  });
});
