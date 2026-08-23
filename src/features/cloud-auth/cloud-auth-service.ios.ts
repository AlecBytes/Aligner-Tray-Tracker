import type { SQLiteDatabase } from 'expo-sqlite';

import {
  performAppleSignIn,
  type AppleSignInResult,
} from '@/features/cloud-auth/apple-sign-in';
import { signOutWithLocalScope } from '@/features/cloud-auth/cloud-sign-out';

export type CloudAuthState =
  | { status: 'loading' }
  | { status: 'unavailable'; message: string }
  | { status: 'signedOut' }
  | { status: 'signedIn' }
  | { status: 'failure'; message: string };

export type CloudSignOutResult =
  | { status: 'signedOut' }
  | { status: 'failure'; message: string };

type CryptoModule = typeof import('expo-crypto');

function isMissingNativeModule(error: unknown) {
  return error instanceof Error && error.message.includes('Cannot find native module');
}

function nativeBuildUnavailable(): CloudAuthState {
  return {
    status: 'unavailable',
    message: 'Cloud Backup requires an updated app build on this device.',
  };
}

async function createRandomValue(crypto: CryptoModule) {
  const bytes = await crypto.getRandomBytesAsync(32);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadCloudAuthState(db: SQLiteDatabase): Promise<CloudAuthState> {
  try {
    const [{ getCloudAuthClient }, AppleAuthentication] = await Promise.all([
      import('@/features/cloud-auth/supabase-client.ios'),
      import('expo-apple-authentication'),
    ]);
    const result = await getCloudAuthClient(db);
    if (result.status === 'unavailable') return result;

    const { data, error } = await result.client.auth.getSession();
    if (error) {
      return { status: 'failure', message: 'Your account status could not be loaded.' };
    }
    if (data.session) return { status: 'signedIn' };

    if (!(await AppleAuthentication.isAvailableAsync())) {
      return {
        status: 'unavailable',
        message: 'Sign in with Apple is unavailable on this device.',
      };
    }

    return { status: 'signedOut' };
  } catch (error) {
    if (isMissingNativeModule(error)) return nativeBuildUnavailable();
    return { status: 'failure', message: 'Your account status could not be loaded.' };
  }
}

export async function subscribeToCloudAuthState(
  db: SQLiteDatabase,
  onStateChange: (state: CloudAuthState) => void,
) {
  try {
    const { getCloudAuthClient } = await import('@/features/cloud-auth/supabase-client.ios');
    const result = await getCloudAuthClient(db);
    if (result.status === 'unavailable') return () => undefined;

    const { data } = result.client.auth.onAuthStateChange((_event, session) => {
      onStateChange(session ? { status: 'signedIn' } : { status: 'signedOut' });
    });
    return () => data.subscription.unsubscribe();
  } catch {
    return () => undefined;
  }
}

export async function signInWithApple(db: SQLiteDatabase): Promise<AppleSignInResult> {
  try {
    const [{ getCloudAuthClient }, AppleAuthentication, Crypto] = await Promise.all([
      import('@/features/cloud-auth/supabase-client.ios'),
      import('expo-apple-authentication'),
      import('expo-crypto'),
    ]);
    const result = await getCloudAuthClient(db);
    if (result.status === 'unavailable') {
      return { status: 'failure', message: result.message };
    }
    if (!(await AppleAuthentication.isAvailableAsync())) {
      return {
        status: 'failure',
        message: 'Sign in with Apple is unavailable on this device.',
      };
    }

    const signInResult = await performAppleSignIn({
      emailScope: AppleAuthentication.AppleAuthenticationScope.EMAIL,
      createRandomValue: () => createRandomValue(Crypto),
      sha256: (value) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
      requestAppleCredential: AppleAuthentication.signInAsync,
      exchangeIdToken: (credentials) => result.client.auth.signInWithIdToken(credentials),
    });

    return signInResult;
  } catch (error) {
    if (isMissingNativeModule(error)) {
      return {
        status: 'failure',
        message: 'Cloud Backup requires an updated app build on this device.',
      };
    }
    return { status: 'failure', message: 'Sign in failed. Please try again.' };
  }
}

export async function signOutLocally(db: SQLiteDatabase): Promise<CloudSignOutResult> {
  try {
    const { getCloudAuthClient } = await import('@/features/cloud-auth/supabase-client.ios');
    const result = await getCloudAuthClient(db);
    if (result.status === 'unavailable') {
      return { status: 'failure', message: result.message };
    }

    const { error } = await signOutWithLocalScope(result.client.auth);
    if (error) {
      return { status: 'failure', message: 'Sign out failed. Please try again.' };
    }
    return { status: 'signedOut' };
  } catch {
    return { status: 'failure', message: 'Sign out failed. Please try again.' };
  }
}

export async function clearLocalCloudSession(db: SQLiteDatabase) {
  const [lifecycle, client] = await Promise.all([
    import('@/features/cloud-auth/cloud-auth-lifecycle.ios'),
    import('@/features/cloud-auth/supabase-client.ios'),
  ]);
  lifecycle.stopCloudAuthLifecycle();
  await client.clearPersistedCloudAuthSession(db);
  void lifecycle.startCloudAuthLifecycle(db).catch(() => undefined);
}
