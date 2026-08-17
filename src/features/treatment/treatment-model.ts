export type TreatmentPlanInput = {
  daysPerTray: number;
  prescribedHoursPerDay: number;
  totalTrays: number;
};

export type TreatmentSetupInput = TreatmentPlanInput & {
  startingTrayNumber: number;
};

export function prescribedHoursToMinutes(prescribedHoursPerDay: number) {
  return Math.round(prescribedHoursPerDay * 60);
}
