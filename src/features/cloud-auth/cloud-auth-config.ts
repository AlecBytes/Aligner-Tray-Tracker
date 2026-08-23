export type CloudAuthConfiguration =
  | {
      status: 'configured';
      url: string;
      publishableKey: string;
    }
  | {
      status: 'unavailable';
      message: string;
    };

const UNAVAILABLE_MESSAGE = 'Cloud Backup is not configured for this build.';

export function resolveCloudAuthConfiguration(input: {
  url?: string;
  publishableKey?: string;
}): CloudAuthConfiguration {
  const urlValue = input.url?.trim();
  const keyValue = input.publishableKey?.trim();

  if (!urlValue || !keyValue || !/^sb_publishable_\S+$/.test(keyValue)) {
    return { status: 'unavailable', message: UNAVAILABLE_MESSAGE };
  }

  try {
    const url = new URL(urlValue);
    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return { status: 'unavailable', message: UNAVAILABLE_MESSAGE };
    }

    return {
      status: 'configured',
      url: url.origin,
      publishableKey: keyValue,
    };
  } catch {
    return { status: 'unavailable', message: UNAVAILABLE_MESSAGE };
  }
}

export function getCloudAuthConfiguration() {
  return resolveCloudAuthConfiguration({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.EXPO_PUBLIC_SUPABASE_KEY,
  });
}
