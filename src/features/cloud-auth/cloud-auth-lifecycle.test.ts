import { createCloudAuthLifecycle } from '@/features/cloud-auth/cloud-auth-lifecycle-core';

describe('cloud auth lifecycle', () => {
  it('refreshes only while active, avoids duplicates, and cleans up', async () => {
    let listener: ((state: 'active' | 'background') => void) | undefined;
    const remove = jest.fn();
    const client = {
      auth: {
        startAutoRefresh: jest.fn(),
        stopAutoRefresh: jest.fn(),
      },
    };
    const getClient = jest.fn(async () => client);
    const lifecycle = createCloudAuthLifecycle({
      getClient,
      appState: {
        currentState: 'active',
        addEventListener: jest.fn((_event, nextListener) => {
          listener = nextListener;
          return { remove };
        }),
      },
    });

    const firstCleanup = await lifecycle.start();
    const secondCleanup = await lifecycle.start();

    expect(firstCleanup).not.toBe(secondCleanup);
    expect(getClient).toHaveBeenCalledTimes(1);
    expect(client.auth.startAutoRefresh).toHaveBeenCalledTimes(1);

    listener?.('background');
    listener?.('background');
    listener?.('active');
    expect(client.auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(client.auth.startAutoRefresh).toHaveBeenCalledTimes(2);

    firstCleanup();
    expect(remove).not.toHaveBeenCalled();
    secondCleanup();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(client.auth.stopAutoRefresh).toHaveBeenCalledTimes(2);

    const thirdCleanup = await lifecycle.start();
    expect(getClient).toHaveBeenCalledTimes(2);
    thirdCleanup();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
