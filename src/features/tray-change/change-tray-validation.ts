const POSITIVE_INTEGER_PATTERN = /^\d+$/;

export type TrayNumberValidationResult =
  | { error: string; success: false }
  | { data: number; success: true };

function trayNumberError(totalTrays: number) {
  return `Enter a whole number from 1 to ${totalTrays}.`;
}

export function validateTrayNumber(
  value: string,
  totalTrays: number,
  currentTrayNumber?: number,
): TrayNumberValidationResult {
  const normalizedValue = value.trim();

  if (!POSITIVE_INTEGER_PATTERN.test(normalizedValue)) {
    return { error: trayNumberError(totalTrays), success: false };
  }

  const trayNumber = Number(normalizedValue);

  if (!Number.isSafeInteger(trayNumber) || trayNumber < 1 || trayNumber > totalTrays) {
    return { error: trayNumberError(totalTrays), success: false };
  }

  if (trayNumber === currentTrayNumber) {
    return { error: `Tray ${trayNumber} is already active.`, success: false };
  }

  return { data: trayNumber, success: true };
}

export function getNextTrayNumber(currentTrayNumber: number, totalTrays: number) {
  return currentTrayNumber < totalTrays ? currentTrayNumber + 1 : null;
}

export function getPreviousTrayNumber(currentTrayNumber: number) {
  return currentTrayNumber > 1 ? currentTrayNumber - 1 : null;
}
