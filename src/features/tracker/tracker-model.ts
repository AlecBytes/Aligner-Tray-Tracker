import type { WearStatus } from '@/db/schema';

export type WearPunchEvent = {
  id: number;
  status: WearStatus;
  timestamp: number;
};

export type TrackerToggleAction = {
  predecessor: WearPunchEvent;
  punch: WearPunchEvent;
  trayPeriodId: number;
};

export type TrackerSnapshot = {
  currentTrayNumber: number;
  daysPerTray: number;
  punches: WearPunchEvent[];
  totalTrays: number;
  trayPeriodId: number;
  trayStartedAt: number;
};

export type TrackerReadModel = {
  currentStatus: WearStatus;
  currentOutSeconds: number;
  currentTrayNumber: number;
  daysRemaining: number;
  inTodaySeconds: number;
  outTodaySeconds: number;
  totalTrays: number;
  trayDay: number;
};
