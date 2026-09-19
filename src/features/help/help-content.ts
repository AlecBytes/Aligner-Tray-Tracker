export type HelpContentSection = {
  title: string;
  items: readonly string[];
  ordered?: boolean;
};

export const HELP_CONTENT_SECTIONS: readonly HelpContentSection[] = [
  {
    title: 'Getting Started',
    ordered: true,
    items: [
      'Enter the treatment plan prescribed by your clinician during setup.',
      'Tap the main tracker control whenever you remove or insert your trays or retainers.',
      'The tracker shows your current tray, treatment day, time remaining, and current IN or OUT state.',
      'Your tracking history is saved on this device and is available when you reopen the app.',
    ],
  },
  {
    title: 'Recording IN and OUT Time',
    items: [
      'IN means your trays or retainers are being worn. OUT means they have been removed.',
      'Tap the main tracker control after you insert or remove them.',
      'While trays are OUT, the tracker shows the current OUT duration.',
      'The tracker records the actions you enter. It does not decide whether you are meeting your prescribed wear instructions.',
    ],
  },
  {
    title: 'Changing Trays',
    items: [
      'Use Change Tray when you begin wearing a different tray.',
      'Choose the next or previous tray, or enter the tray number you need.',
      'A newly started tray remains OUT until you mark it IN after insertion.',
      'Changing trays preserves the treatment history you already recorded.',
    ],
  },
  {
    title: 'Correcting a Time',
    items: [
      'Open Edit In/Out Times from Menu when an event was entered incorrectly or missed.',
      'Choose the date and event you need to correct, or add the missing time.',
      'Corrections update the saved history used for intervals and statistics.',
    ],
  },
  {
    title: 'Notifications',
    items: [
      'Notifications can remind you when trays have been OUT too long, repeat that reminder, and remind you when a tray change is due or overdue.',
      'Retainer Mode provides separate bedtime and morning reminder settings.',
      'Reminder delivery depends on notification permission and your device settings.',
      'Notifications are a convenience and do not replace your treatment instructions.',
    ],
  },
  {
    title: 'Retainer Mode',
    items: [
      'Use Retainer Mode after active aligner treatment is complete, according to your clinician\'s instructions.',
      'The retainer tracker uses the same IN and OUT interaction to record retainer wear.',
      'Retainer Mode shows retainer duration and reminder information instead of tray number, treatment day, remaining days, and aligner daily totals.',
      'Change Tray is unavailable in Retainer Mode because tray progression is complete.',
    ],
  },
] as const;
