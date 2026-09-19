import Purchases from 'react-native-purchases';

let configuredApiKey: string | null = null;

export function configureRevenueCat(apiKey: string): void {
  if (configuredApiKey === apiKey) {
    return;
  }

  if (configuredApiKey !== null) {
    throw new Error('RevenueCat is already configured with a different API key.');
  }

  Purchases.configure({ apiKey });
  configuredApiKey = apiKey;
}

export function resetRevenueCatConfigurationForTests(): void {
  configuredApiKey = null;
}
