import type { WearStatus } from '@/db/schema';

export type EditableWearPunch = {
  id: number;
  status: WearStatus;
  timestamp: number;
  trayPeriodId: number;
};

export type TrayPeriodWindow = {
  endedAt: number | null;
  id: number;
  startedAt: number;
};

export type MissingPeriodInput = {
  endTimestamp: number;
  startTimestamp: number;
  status: WearStatus;
};

export type PlannedWearPunch = {
  status: WearStatus;
  timestamp: number;
};

