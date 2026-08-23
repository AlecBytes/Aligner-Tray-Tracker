import {
  describeAppleSignInFailure,
  performAppleSignIn,
} from '@/features/cloud-auth/apple-sign-in';

function createDependencies() {
  const randomValues = ['raw-nonce', 'independent-state'];
  return {
    emailScope: 1,
    createRandomValue: jest.fn(async () => randomValues.shift()!),
    sha256: jest.fn(async () => 'hashed-nonce'),
    requestAppleCredential: jest.fn(
      async (): Promise<{ state: string | null; identityToken: string | null }> => ({
        state: 'independent-state',
        identityToken: 'apple-id-token',
      }),
    ),
    exchangeIdToken: jest.fn(async () => ({ error: null })),
  };
}

describe('Apple sign-in', () => {
  it('sends the hashed nonce to Apple and the raw nonce to Supabase', async () => {
    const dependencies = createDependencies();

    await expect(performAppleSignIn(dependencies)).resolves.toEqual({ status: 'signedIn' });

    expect(dependencies.sha256).toHaveBeenCalledWith('raw-nonce');
    expect(dependencies.requestAppleCredential).toHaveBeenCalledWith({
      nonce: 'hashed-nonce',
      state: 'independent-state',
      requestedScopes: [1],
    });
    expect(dependencies.exchangeIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-id-token',
      nonce: 'raw-nonce',
    });
  });

  it.each([
    [{ state: 'wrong-state', identityToken: 'token' }, 'a state mismatch'],
    [{ state: 'independent-state', identityToken: null }, 'a missing identity token'],
  ])('rejects %s (%s)', async (credential, _description) => {
    const dependencies = createDependencies();
    dependencies.requestAppleCredential.mockResolvedValue(credential);

    await expect(performAppleSignIn(dependencies)).resolves.toMatchObject({ status: 'failure' });
    expect(dependencies.exchangeIdToken).not.toHaveBeenCalled();
  });

  it('returns cancellation separately', async () => {
    const dependencies = createDependencies();
    dependencies.requestAppleCredential.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });

    await expect(performAppleSignIn(dependencies)).resolves.toEqual({ status: 'cancelled' });
  });

  it.each([
    ['Unacceptable audience in id_token', 'This app build is not allowed'],
    ['Provider apple is not enabled', 'Sign in with Apple is not enabled'],
    ['Nonce mismatch', 'Apple sign-in verification failed'],
    ['Network request failed', 'cloud authentication service could not be reached'],
  ])('classifies a safe diagnostic for %s', (message, expected) => {
    expect(describeAppleSignInFailure({ message })).toContain(expected);
  });
});
