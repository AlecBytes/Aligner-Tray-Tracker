export type DatabaseId = number;

export type WearStatus = 'IN' | 'OUT';

export type Treatment = {
  createdAt: number;
  id: DatabaseId;
};

export type TreatmentPlanVersion = {
  createdAt: number;
  dailyWearGoalMinutes: number;
  daysPerTray: number;
  effectiveAt: number;
  id: DatabaseId;
  totalTrays: number;
  treatmentId: DatabaseId;
};

export type TrayPeriod = {
  endedAt: number | null;
  id: DatabaseId;
  startedAt: number;
  trayNumber: number;
  treatmentId: DatabaseId;
};

export type WearPunch = {
  id: DatabaseId;
  status: WearStatus;
  timestamp: number;
  trayPeriodId: DatabaseId;
};

export type Settings = {
  notificationsEnabled: boolean;
  outReminderMinutes: number;
};
