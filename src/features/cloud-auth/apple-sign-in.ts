export type AppleSignInResult =
  | { status: 'signedIn' }
  | { status: 'cancelled' }
  | { status: 'failure'; message: string };

type AppleCredential = {
  state: string | null;
  identityToken: string | null;
};

type AppleSignInDependencies = {
  emailScope: number;
  createRandomValue: () => Promise<string>;
  sha256: (value: string) => Promise<string>;
  requestAppleCredential: (options: {
    nonce: string;
    state: string;
    requestedScopes: number[];
  }) => Promise<AppleCredential>;
  exchangeIdToken: (credentials: {
    provider: 'apple';
    token: string;
    nonce: string;
  }) => Promise<{ error: unknown | null }>;
};

function isCancellation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_REQUEST_CANCELED'
  );
}

export function describeAppleSignInFailure(error: unknown) {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message).toLowerCase()
      : '';

  if (message.includes('audience') || message.includes('client id')) {
    return 'This app build is not allowed by the configured Apple provider.';
  }
  if (message.includes('provider') && message.includes('not enabled')) {
    return 'Sign in with Apple is not enabled for this cloud project.';
  }
  if (message.includes('nonce')) {
    return 'Apple sign-in verification failed. Please try again.';
  }
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection')
  ) {
    return 'The cloud authentication service could not be reached.';
  }

  return 'Sign in failed. Please try again.';
}

export async function performAppleSignIn(
  dependencies: AppleSignInDependencies,
): Promise<AppleSignInResult> {
  try {
    const [rawNonce, state] = await Promise.all([
      dependencies.createRandomValue(),
      dependencies.createRandomValue(),
    ]);
    const hashedNonce = await dependencies.sha256(rawNonce);
    const credential = await dependencies.requestAppleCredential({
      nonce: hashedNonce,
      state,
      requestedScopes: [dependencies.emailScope],
    });

    if (credential.state !== state || !credential.identityToken) {
      return {
        status: 'failure',
        message: 'Sign in could not be verified. Please try again.',
      };
    }

    const { error } = await dependencies.exchangeIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) {
      return { status: 'failure', message: describeAppleSignInFailure(error) };
    }

    return { status: 'signedIn' };
  } catch (error) {
    if (isCancellation(error)) return { status: 'cancelled' };
    return { status: 'failure', message: describeAppleSignInFailure(error) };
  }
}
