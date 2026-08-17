import type { TreatmentPlanInput } from '@/features/treatment/treatment-model';

export type TreatmentPlanFormValues = {
  daysPerTray: string;
  prescribedHoursPerDay: string;
  totalTrays: string;
};

export type TreatmentPlanValidationErrors = Partial<
  Record<keyof TreatmentPlanFormValues, string>
>;

export type TreatmentPlanValidationResult =
  | { errors: TreatmentPlanValidationErrors; success: false }
  | { data: TreatmentPlanInput; success: true };

const POSITIVE_INTEGER_PATTERN = /^\d+$/;
const DECIMAL_NUMBER_PATTERN = /^(?:\d+\.?\d*|\.\d+)$/;

export function parsePositiveInteger(value: string) {
  const normalizedValue = value.trim();

  if (!POSITIVE_INTEGER_PATTERN.test(normalizedValue)) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isSafeInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function parsePrescribedHours(value: string) {
  const normalizedValue = value.trim().replace(',', '.');

  if (!DECIMAL_NUMBER_PATTERN.test(normalizedValue)) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) && parsedValue > 0 && parsedValue <= 24 ? parsedValue : null;
}

export function validateTreatmentPlan(
  values: TreatmentPlanFormValues,
  minimumTotalTrays = 1,
): TreatmentPlanValidationResult {
  const errors: TreatmentPlanValidationErrors = {};
  const totalTrays = parsePositiveInteger(values.totalTrays);
  const daysPerTray = parsePositiveInteger(values.daysPerTray);
  const prescribedHoursPerDay = parsePrescribedHours(values.prescribedHoursPerDay);

  if (totalTrays === null) {
    errors.totalTrays = 'Enter a positive whole number.';
  } else if (totalTrays < minimumTotalTrays) {
    errors.totalTrays = `Total trays cannot be less than the current tray (${minimumTotalTrays}).`;
  }

  if (daysPerTray === null) {
    errors.daysPerTray = 'Enter a positive whole number.';
  }

  if (prescribedHoursPerDay === null) {
    errors.prescribedHoursPerDay = 'Enter a number greater than 0 and no greater than 24.';
  }

  if (
    totalTrays === null ||
    totalTrays < minimumTotalTrays ||
    daysPerTray === null ||
    prescribedHoursPerDay === null
  ) {
    return { errors, success: false };
  }

  return {
    data: { daysPerTray, prescribedHoursPerDay, totalTrays },
    success: true,
  };
}
