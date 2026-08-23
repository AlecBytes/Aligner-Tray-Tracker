import { signOutWithLocalScope } from '@/features/cloud-auth/cloud-sign-out';

describe('cloud sign-out', () => {
  it('uses local scope and does not invoke a cloud-deletion operation', async () => {
    const signOut = jest.fn(async () => ({ error: null }));
    const deleteAccount = jest.fn();

    await signOutWithLocalScope({ signOut });

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
