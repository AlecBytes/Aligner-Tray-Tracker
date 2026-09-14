import { createTrackerRefreshCoordinator } from './tracker-refresh-coordinator';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup() {
  const callbacks = {
    read: jest.fn(async () => 'persisted'), start: jest.fn(), accept: jest.fn(),
    fail: jest.fn(), settled: jest.fn(),
  };
  return { ...callbacks, coordinator: createTrackerRefreshCoordinator<string, string>(callbacks) };
}

it('invalidates a read begun before a mutation and accepts only the post-commit read', async () => {
  const { coordinator, read, accept, settled } = setup();
  const oldRead = deferred<string>();
  read.mockReturnValueOnce(oldRead.promise);
  const initial = coordinator.activate();
  const token = coordinator.beginMutation()!;
  expect(coordinator.isCurrent(token)).toBe(true);
  await coordinator.refresh();
  expect(read).toHaveBeenCalledTimes(1);
  oldRead.resolve('old OUT');
  await initial;
  expect(accept).not.toHaveBeenCalled();
  expect(settled).not.toHaveBeenCalled();
  await coordinator.finishMutation('saved');
  expect(accept).toHaveBeenCalledTimes(1);
  expect(accept).toHaveBeenCalledWith('persisted', 'saved');
});

it('rejects duplicate mutations until the current mutation finishes', async () => {
  const { coordinator, read } = setup();
  await coordinator.activate();
  const readback = deferred<string>();
  read.mockReturnValueOnce(readback.promise);
  expect(coordinator.beginMutation()).not.toBeNull();
  expect(coordinator.beginMutation()).toBeNull();
  const finishing = coordinator.finishMutation();
  expect(coordinator.beginMutation()).toBeNull();
  readback.resolve('persisted');
  await finishing;
  expect(coordinator.beginMutation()).not.toBeNull();
});

it('discards rejected reads after unmount without delivering error or completion', async () => {
  const { coordinator, read, fail, settled } = setup();
  const pending = deferred<string>();
  read.mockReturnValueOnce(pending.promise);
  const initial = coordinator.activate();
  coordinator.deactivate();
  pending.reject(new Error('late read failure'));
  await initial;
  expect(fail).not.toHaveBeenCalled();
  expect(settled).not.toHaveBeenCalled();
});

it('handles blur/refocus during a mutation with one fresh read after completion', async () => {
  const { coordinator, read, accept } = setup();
  await coordinator.activate();
  const token = coordinator.beginMutation()!;
  coordinator.deactivate();
  await coordinator.activate();
  expect(coordinator.isCurrent(token)).toBe(false);
  expect(read).toHaveBeenCalledTimes(1);
  await coordinator.finishMutation('saved');
  expect(read).toHaveBeenCalledTimes(2);
  expect(accept).toHaveBeenLastCalledWith('persisted', 'saved');
});
