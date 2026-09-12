import Constants from 'expo-constants';

const DEFAULT_SUPPORT_CONTACT = 'support@example.com';
const configuredSupportContact = Constants.expoConfig?.extra?.supportContact;

export function resolveSupportContact(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const contact = value.trim();

  if (contact.length === 0 || contact.toLowerCase() === DEFAULT_SUPPORT_CONTACT) {
    return null;
  }

  return contact;
}

export const supportContact = resolveSupportContact(configuredSupportContact);
