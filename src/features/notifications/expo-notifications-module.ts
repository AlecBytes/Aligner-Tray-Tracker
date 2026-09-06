// Keep native module loading lazy and separate from scheduling policy so the
// notification adapter can also be exercised without a native runtime.
export function loadExpoNotificationsModule() {
  return import('expo-notifications');
}
