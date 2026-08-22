import type { WearPunchDeletionPlan } from '@/features/edit-times/edit-times-model';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function getWearPunchDeletionConfirmation(plan: WearPunchDeletionPlan) {
  const selectedDescription = `${plan.selectedPunch.status} event at ${dateTimeFormatter.format(
    plan.selectedPunch.timestamp,
  )}`;

  if (plan.followingPunch) {
    return {
      message:
        `This removes the ${selectedDescription} and the following ` +
        `${plan.followingPunch.status} event at ${dateTimeFormatter.format(
          plan.followingPunch.timestamp,
        )}. The surrounding ${plan.previousPunch.status} time will be combined. ` +
        'This cannot be undone.',
      title: `Delete ${plan.selectedPunch.status} period?`,
    };
  }

  return {
    message:
      `This removes the latest ${selectedDescription}. The preceding ` +
      `${plan.previousPunch.status} period will continue through the end of this tray period. ` +
      'This cannot be undone.',
    title: `Delete latest ${plan.selectedPunch.status} event?`,
  };
}
