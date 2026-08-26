export function reconcileNotificationsForPlatform(
  platform: string,
  nativeCoordinatorAvailable: boolean,
  reconcileNative: () => Promise<unknown>,
  reconcileExpo: () => Promise<unknown>,
) {
  return platform === 'ios' && nativeCoordinatorAvailable
    ? reconcileNative()
    : reconcileExpo();
}
