import { Button, Form, HStack, Host, Rectangle, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHint, accessibilityLabel, background, buttonStyle, disabled, foregroundStyle, frame } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { usePaidAccess } from '@/features/paid-access/paid-access-provider';
import { themeColors, themeKeys, themeNames, type ThemeKey } from '@/theme/tokens';
import { useAppTheme, useAppThemeState } from '@/theme/use-app-theme';
import { useColorScheme } from 'react-native';
import { ValidationMessage } from '@/components/expo-ui-components';

export function ThemesScreen() {
  const router = useRouter(); const theme = useAppTheme(); const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'; const { access, restore, manage } = usePaidAccess(); const { savedThemeKey, effectiveThemeKey, selectTheme } = useAppThemeState(); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function choose(key: ThemeKey) { setError(null); if (key !== 'default' && !access.hasPremiumAccess) { router.push({ pathname: '/premium', params: { pendingTheme: key } } as never); return; } try { await selectTheme(key); } catch { setError('Your theme could not be saved. Please try again.'); } }
  async function restorePurchases() { if (busy) return; setBusy(true); setError(null); try { setMessage(await restore() ? 'Premium access restored.' : 'No eligible purchases were found.'); } catch { setError('Purchases could not be restored. Please try again.'); } finally { setBusy(false); } }
  return <Host seedColor={theme.primary} style={{ flex: 1 }}><Form>
    <Section footer={savedThemeKey !== 'default' && effectiveThemeKey === 'default' ? <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>Your saved theme is locked. Default is currently in use.</Text> : undefined}>
      {themeKeys.map((key) => { const locked = key !== 'default' && !access.hasPremiumAccess; const selected = key === savedThemeKey; return <Button key={key} onPress={() => void choose(key)} modifiers={[buttonStyle('plain'), accessibilityLabel(`${themeNames[key]}, ${selected ? 'selected' : locked ? 'locked' : 'available'}`), accessibilityHint(locked ? 'Opens premium purchase options' : 'Applies this theme')]}><HStack spacing={12} modifiers={[frame({ minHeight: 44, maxWidth: Infinity, alignment: 'leading' })]}><Rectangle modifiers={[background(themeColors(key, scheme).primary), frame({ width: 30, height: 30 })]} /><Text>{themeNames[key]}</Text><Spacer/><Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{selected ? 'Selected' : locked ? 'Locked' : ''}</Text></HStack></Button>; })}
    </Section>
    <Section title="Premium access"><Button label={busy ? 'Restoring…' : 'Restore Purchases'} onPress={() => void restorePurchases()} modifiers={[disabled(busy)]} systemImage="arrow.clockwise"/><Button label="Manage Subscription" onPress={() => void manage().catch(() => setError('Subscription management is unavailable.'))} systemImage="creditcard"/>{message ? <Text>{message}</Text> : null}<ValidationMessage message={error}/></Section>
    <Section title="Preview"><VStack alignment="leading" spacing={8}><Text>Selected accents apply to app actions and controls.</Text><HStack spacing={8}>{themeKeys.map((key) => <Rectangle key={key} modifiers={[background(themeColors(key, scheme).primary), frame({ width: 30, height: 18 })]}/>)}</HStack></VStack></Section>
  </Form></Host>;
}
