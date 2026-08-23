export async function resetAppWithLocalSession(input: {
  clearLocalSession: () => Promise<void>;
  resetLocalData: () => Promise<void>;
  reconcileNotifications: () => Promise<void>;
}) {
  await input.clearLocalSession();
  await input.resetLocalData();
  await input.reconcileNotifications();
}
