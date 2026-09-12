export type SupportContactIntent = 'standard' | 'premium';

type OpenUrl = (url: string) => Promise<unknown>;

const PREMIUM_SUBJECT = 'Aligner Tracker Pro Support';
const PREMIUM_BODY = 'How can I help?';

export function buildSupportEmailUrl(
  contact: string | null,
  intent: SupportContactIntent,
): string | null {
  if (!contact) {
    return null;
  }

  const recipient = encodeURIComponent(contact);

  if (intent === 'standard') {
    return `mailto:${recipient}`;
  }

  return `mailto:${recipient}?subject=${encodeURIComponent(PREMIUM_SUBJECT)}&body=${encodeURIComponent(PREMIUM_BODY)}`;
}

export async function openSupportEmail({
  contact,
  intent,
  openUrl,
}: {
  contact: string | null;
  intent: SupportContactIntent;
  openUrl: OpenUrl;
}): Promise<boolean> {
  const url = buildSupportEmailUrl(contact, intent);

  if (!url) {
    return false;
  }

  try {
    await openUrl(url);
    return true;
  } catch {
    return false;
  }
}
