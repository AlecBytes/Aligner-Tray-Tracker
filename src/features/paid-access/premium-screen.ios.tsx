import { Button, Form, Host, Section, Text } from '@expo/ui/swift-ui';
import { disabled, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { useEffect, useState } from 'react';
import { ActionButton, ValidationMessage } from '@/components/expo-ui-components';
import { paidAccessConfig } from './paid-access-config';
import { usePaidAccess } from './paid-access-provider';
import type { PaidAccessPackage } from './paid-access-service';
import { useAppTheme } from '@/theme/use-app-theme';

const labels: Record<PaidAccessPackage['kind'], string> = { monthly: 'Monthly', annual: 'Annual', lifetime: 'Lifetime' };
const terms: Record<PaidAccessPackage['kind'], string> = { monthly: 'renews monthly', annual: 'renews annually', lifetime: 'one-time payment, no renewal' };
export function PremiumScreen() {
  const router = useRouter(); const theme = useAppTheme(); const { access, packages, packagesUnavailable, loadPackages, purchase, restore, manage } = usePaidAccess(); const [busy, setBusy] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void loadPackages(); }, [loadPackages]);
  async function buy(item: PaidAccessPackage) { if (busy) return; setBusy(item.id); setError(null); setMessage(null); try { const outcome = await purchase(item.id); if (outcome === 'cancelled') setMessage('Purchase cancelled. You were not charged.'); else if (outcome === 'pending') setMessage('Purchase approval is pending. Premium features will unlock after access is confirmed.'); else setMessage('Premium access is active.'); } catch { setError('The purchase could not be completed. Please try again.'); } finally { setBusy(null); } }
  async function doRestore() { if (busy) return; setBusy('restore'); setError(null); try { setMessage(await restore() ? 'Premium access restored.' : 'No eligible purchases were found.'); } catch { setError('Purchases could not be restored. Please try again.'); } finally { setBusy(null); } }
  return <Host seedColor={theme.primary} style={{ flex: 1 }}><Form>
    <Section title="Premium"><Text>Get Premium Support with priority email handling and more personalized troubleshooting. Themes and core tracking remain free.</Text></Section>
    {access.isLifetime ? <Section><Text>Lifetime premium access is active.</Text></Section> : <Section title="Choose access">{access.hasPremiumAccess ? <Text>Your subscription stays active until you cancel it separately in Manage Subscription. Buying lifetime access does not cancel recurring billing.</Text> : null}{packagesUnavailable ? <Text>Purchase options are unavailable. Try again later.</Text> : packages.map((item) => <ActionButton key={item.id} label={`${labels[item.kind]} — ${item.displayPrice}, ${terms[item.kind]}`} onPress={() => void buy(item)} pending={busy === item.id} disabled={busy !== null}/>)}</Section>}
    <Section><Button label={busy === 'restore' ? 'Restoring…' : 'Restore Purchases'} modifiers={[disabled(busy !== null)]} onPress={() => void doRestore()} systemImage="arrow.clockwise"/><Button label="Manage Subscription" modifiers={[disabled(busy !== null)]} onPress={() => void manage().catch(() => setError('Subscription management is unavailable.'))} systemImage="creditcard"/><Button label="Dismiss" onPress={() => router.dismiss()} role="cancel"/>{message ? <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{message}</Text> : null}<ValidationMessage message={error}/></Section>
    <Section title="Policies">{paidAccessConfig.termsUrl ? <Button label="Terms of Use" onPress={() => void Linking.openURL(paidAccessConfig.termsUrl!)} systemImage="doc.text"/> : <Text>Terms of Use link is not configured.</Text>}{paidAccessConfig.privacyUrl ? <Button label="Privacy Policy" onPress={() => void Linking.openURL(paidAccessConfig.privacyUrl!)} systemImage="hand.raised"/> : <Text>Privacy Policy link is not configured.</Text>}</Section>
  </Form></Host>;
}
