import { createCloudRestoreScreenOperation } from '@/features/cloud-backup/cloud-restore-screen-operation';
import type { RecoveryPoint } from '@/features/cloud-backup/cloud-restore-core';

const point = {} as RecoveryPoint;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('cloud restore screen operation', () => {
  it('locks duplicate restore starts and reports one completion', async () => {
    const completion = deferred<{
      status: 'restored';
      reminders: 'reconciled';
    }>();
    const onStart = jest.fn();
    const onResult = jest.fn();
    const onFinish = jest.fn();
    const perform = jest.fn(() => completion.promise);
    const operation = createCloudRestoreScreenOperation({
      onFinish,
      onResult,
      onStart,
      perform,
    });

    const first = operation.start(point);
    await expect(operation.start(point)).resolves.toBe(false);
    expect(perform).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledTimes(1);

    completion.resolve({ status: 'restored', reminders: 'reconciled' });
    await expect(first).resolves.toBe(true);
    expect(onResult).toHaveBeenCalledWith({ status: 'restored', reminders: 'reconciled' });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('aborts a departing screen and suppresses stale callbacks', async () => {
    const completion = deferred<{
      status: 'restored';
      reminders: 'reconciled';
    }>();
    const signals: AbortSignal[] = [];
    const onResult = jest.fn();
    const onFinish = jest.fn();
    const operation = createCloudRestoreScreenOperation({
      onFinish,
      onResult,
      onStart: jest.fn(),
      perform: (_point, nextSignal) => {
        signals.push(nextSignal);
        return completion.promise;
      },
    });

    const running = operation.start(point);
    operation.dispose();
    expect(signals[0]?.aborted).toBe(true);
    completion.resolve({ status: 'restored', reminders: 'reconciled' });
    await running;
    expect(onResult).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
    await expect(operation.start(point)).resolves.toBe(false);
  });
});
