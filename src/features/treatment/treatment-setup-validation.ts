import type { TreatmentSetupInput } from '@/features/treatment/treatment-model';
import {
  parsePositiveInteger,
  type TreatmentPlanFormValues,
  type TreatmentPlanValidationErrors,
  validateTreatmentPlan,
} from '@/features/treatment/treatment-plan-validation';

export type TreatmentSetupFormValues = TreatmentPlanFormValues & {
  startingTrayNumber: string;
};

export type TreatmentSetupValidationErrors = TreatmentPlanValidationErrors & {
  startingTrayNumber?: string;
};

export type TreatmentSetupValidationResult =
  | { errors: TreatmentSetupValidationErrors; success: false }
  | { data: TreatmentSetupInput; success: true };

export function validateTreatmentSetup(
  values: TreatmentSetupFormValues,
): TreatmentSetupValidationResult {
  const planValidation = validateTreatmentPlan(values);
  const errors: TreatmentSetupValidationErrors = planValidation.success
    ? {}
    : { ...planValidation.errors };
  const startingTrayNumber = parsePositiveInteger(values.startingTrayNumber);

  if (startingTrayNumber === null) {
    errors.startingTrayNumber = 'Enter a positive whole number.';
  } else if (planValidation.success && startingTrayNumber > planValidation.data.totalTrays) {
    errors.startingTrayNumber = 'Starting tray cannot exceed total trays.';
  }

  if (!planValidation.success || startingTrayNumber === null || Object.keys(errors).length > 0) {
    return { errors, success: false };
  }

  return {
    data: {
      ...planValidation.data,
      startingTrayNumber,
    },
    success: true,
  };
}
