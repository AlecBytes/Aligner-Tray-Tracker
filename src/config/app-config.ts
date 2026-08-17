import Constants from 'expo-constants';

const DEFAULT_SUPPORT_CONTACT = 'support@example.com';
const configuredSupportContact = Constants.expoConfig?.extra?.supportContact;

export const supportContact =
  typeof configuredSupportContact === 'string' && configuredSupportContact.trim().length > 0
    ? configuredSupportContact.trim()
    : DEFAULT_SUPPORT_CONTACT;
