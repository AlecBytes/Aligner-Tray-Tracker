import { createManualBackupScreenOperation } from '@/features/cloud-backup/manual-backup-screen-operation';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('manual backup screen operation', () => {
  it('locks duplicate starts and reports progress through completion', async () => {
    const completion = deferred<{ status: 'created'; completedAt: string }>();
    const onStart = jest.fn();
    const onResult = jest.fn();
    const onFinish = jest.fn();
    const operation = createManualBackupScreenOperation({
      perform: jest.fn(() => completion.promise),
      onStart,
      onResult,
      onFinish,
    });

    const first = operation.start();
    await expect(operation.start()).resolves.toBe(false);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();

    completion.resolve({ status: 'created', completedAt: '2026-08-23T04:15:00.000Z' });
    await expect(first).resolves.toBe(true);
    expect(onResult).toHaveBeenCalledWith({
      status: 'created',
      completedAt: '2026-08-23T04:15:00.000Z',
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('lets work finish after disposal without updating the departed screen', async () => {
    const completion = deferred<{ status: 'current'; completedAt: string }>();
    const onResult = jest.fn();
    const onFinish = jest.fn();
    const operation = createManualBackupScreenOperation({
      perform: () => completion.promise,
      onStart: jest.fn(),
      onResult,
      onFinish,
    });

    const running = operation.start();
    operation.dispose();
    completion.resolve({ status: 'current', completedAt: '2026-08-23T04:15:00.000Z' });

    await expect(running).resolves.toBe(true);
    expect(onResult).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
    await expect(operation.start()).resolves.toBe(false);
  });
});
