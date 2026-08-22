import type { WearStatus } from '@/db/schema';
import type {
  EditableWearPunch,
  MissingPeriodInput,
  PlannedWearPunch,
  TrayPeriodWindow,
  WearPunchDeletionPlan,
} from '@/features/edit-times/edit-times-model';

export class CorrectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorrectionValidationError';
  }
}

function orderPunches(punches: readonly EditableWearPunch[]) {
  return [...punches].sort(
    (left, right) => left.timestamp - right.timestamp || left.id - right.id,
  );
}

function isTimestampWithinPeriod(period: TrayPeriodWindow, timestamp: number) {
  return timestamp >= period.startedAt &&
    (period.endedAt === null || timestamp <= period.endedAt);
}

function oppositeStatus(status: WearStatus): WearStatus {
  return status === 'IN' ? 'OUT' : 'IN';
}

export function assertValidWearTimeline(
  period: TrayPeriodWindow,
  punches: readonly EditableWearPunch[],
) {
  const orderedPunches = orderPunches(punches);

  for (let index = 0; index < orderedPunches.length; index += 1) {
    const punch = orderedPunches[index];
    const previousPunch = orderedPunches[index - 1];

    if (punch.trayPeriodId !== period.id) {
      throw new CorrectionValidationError(
        'Punch history must stay within one tray period.',
      );
    }

    if (
      !Number.isSafeInteger(punch.timestamp) ||
      !isTimestampWithinPeriod(period, punch.timestamp)
    ) {
      throw new CorrectionValidationError(
        'The saved punch history does not fit within its tray period.',
      );
    }

    if (previousPunch && punch.timestamp <= previousPunch.timestamp) {
      throw new CorrectionValidationError('Punch times must be in chronological order.');
    }

    if (previousPunch?.status === punch.status) {
      throw new CorrectionValidationError('Punch history must alternate between IN and OUT.');
    }
  }
}

export function validateEditedPunchTimestamp(
  period: TrayPeriodWindow,
  punches: readonly EditableWearPunch[],
  punchId: number,
  newTimestamp: number,
) {
  assertValidWearTimeline(period, punches);

  if (!Number.isSafeInteger(newTimestamp)) {
    throw new CorrectionValidationError('Enter a valid date and time.');
  }

  if (!isTimestampWithinPeriod(period, newTimestamp)) {
    throw new CorrectionValidationError('The time must stay within this tray period.');
  }

  const orderedPunches = orderPunches(punches);
  const punchIndex = orderedPunches.findIndex((punch) => punch.id === punchId);

  if (punchIndex < 0) {
    throw new CorrectionValidationError('The punch no longer exists.');
  }

  const precedingPunch = orderedPunches[punchIndex - 1];
  const followingPunch = orderedPunches[punchIndex + 1];

  if (precedingPunch && newTimestamp <= precedingPunch.timestamp) {
    throw new CorrectionValidationError('The time must be after the preceding punch.');
  }

  if (followingPunch && newTimestamp >= followingPunch.timestamp) {
    throw new CorrectionValidationError('The time must be before the following punch.');
  }

  const correctedPunches = orderedPunches.map((punch) =>
    punch.id === punchId ? { ...punch, timestamp: newTimestamp } : punch,
  );
  assertValidWearTimeline(period, correctedPunches);
}

export function planWearPunchDeletion(
  period: TrayPeriodWindow,
  punches: readonly EditableWearPunch[],
  punchId: number,
): WearPunchDeletionPlan {
  assertValidWearTimeline(period, punches);

  const orderedPunches = orderPunches(punches);
  const punchIndex = orderedPunches.findIndex((punch) => punch.id === punchId);

  if (punchIndex < 0) {
    throw new CorrectionValidationError('The punch no longer exists.');
  }

  if (punchIndex === 0) {
    throw new CorrectionValidationError(
      'The first punch anchors this tray period and cannot be deleted.',
    );
  }

  const previousPunch = orderedPunches[punchIndex - 1];
  const selectedPunch = orderedPunches[punchIndex];
  const followingPunch = orderedPunches[punchIndex + 1] ?? null;
  const punchesToDelete = followingPunch
    ? [selectedPunch, followingPunch]
    : [selectedPunch];
  const deletedIds = new Set(punchesToDelete.map((punch) => punch.id));
  const remainingPunches = orderedPunches.filter((punch) => !deletedIds.has(punch.id));

  assertValidWearTimeline(period, remainingPunches);

  return {
    followingPunch,
    previousPunch,
    punchesToDelete,
    selectedPunch,
  };
}

export function planMissingWearPeriod(
  period: TrayPeriodWindow,
  punches: readonly EditableWearPunch[],
  input: MissingPeriodInput,
): PlannedWearPunch[] {
  assertValidWearTimeline(period, punches);

  if (
    !Number.isSafeInteger(input.startTimestamp) ||
    !Number.isSafeInteger(input.endTimestamp)
  ) {
    throw new CorrectionValidationError('Enter valid start and end times.');
  }

  if (input.endTimestamp <= input.startTimestamp) {
    throw new CorrectionValidationError('End time must be later than start time.');
  }

  if (
    !isTimestampWithinPeriod(period, input.startTimestamp) ||
    !isTimestampWithinPeriod(period, input.endTimestamp)
  ) {
    throw new CorrectionValidationError('The missing time must stay within one tray period.');
  }

  const orderedPunches = orderPunches(punches);
  const precedingPunch = orderedPunches.findLast(
    (punch) => punch.timestamp < input.startTimestamp,
  );
  const overlappingPunch = orderedPunches.find(
    (punch) =>
      punch.timestamp >= input.startTimestamp && punch.timestamp <= input.endTimestamp,
  );

  if (!precedingPunch) {
    throw new CorrectionValidationError(
      'The saved state before this period is unknown, so it cannot be added safely.',
    );
  }

  if (overlappingPunch) {
    throw new CorrectionValidationError('The missing time overlaps existing punch history.');
  }

  if (precedingPunch.status === input.status) {
    throw new CorrectionValidationError(
      `Trays were already recorded as ${input.status} during this period.`,
    );
  }

  const plannedPunches: PlannedWearPunch[] = [
    { status: input.status, timestamp: input.startTimestamp },
    { status: oppositeStatus(input.status), timestamp: input.endTimestamp },
  ];
  const correctedPunches: EditableWearPunch[] = [
    ...orderedPunches,
    ...plannedPunches.map((punch, index) => ({
      ...punch,
      id: Number.MAX_SAFE_INTEGER - index,
      trayPeriodId: period.id,
    })),
  ];

  assertValidWearTimeline(period, correctedPunches);
  return plannedPunches;
}
