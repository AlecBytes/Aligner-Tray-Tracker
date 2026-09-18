import { Button, Host, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, controlSize, disabled, font, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { AppLoadingScreen } from '@/components/app-loading-screen';
import { useAppTheme } from '@/theme/use-app-theme';
import { retainerDuration, useRetainer } from './use-retainer';
import { nextLocalTime } from './retainer-repository';
export function RetainerTrackerScreen() {
  const { snapshot, now, error, busy, toggle } = useRetainer();
  const router = useRouter();
  const theme = useAppTheme();
  if (!snapshot) return <AppLoadingScreen message={error ?? 'Loading retainers…'} />;
  const [latest, previous] = snapshot.punches;
  const inside = latest.status === 'IN';
  const reminderEnabled = inside ? snapshot.settings.morning_enabled : snapshot.settings.bedtime_enabled;
  const reminder = nextLocalTime(now, inside ? snapshot.settings.morning_minutes : snapshot.settings.bedtime_minutes);
  return <Host seedColor={theme.primary} style={{ flex: 1 }}><VStack spacing={20} modifiers={[padding({ all: 24 }), frame({ maxHeight: Infinity })]}>
    <Button label="Menu" onPress={() => router.push('/menu')} />
    <Spacer /><Text modifiers={[font({ textStyle: 'headline' })]}>RETAINER MODE</Text>
    <Text>{inside ? 'Retainers are IN' : 'Retainers are OUT'}</Text>
    {inside ? <Text modifiers={[font({ textStyle: 'largeTitle' })]}>{retainerDuration(now - latest.timestamp)}</Text> : null}
    <Button label={inside ? 'RETAINERS ARE IN' : 'RETAINERS ARE OUT'} onPress={() => void toggle()} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ minHeight: 100, maxWidth: Infinity }), disabled(busy), accessibilityLabel(inside ? 'Retainers are in. Tap when removed.' : 'Retainers are out. Tap when inserted.')]} />
    <Text>{inside ? 'Tap when removed' : 'Tap when inserted'}</Text>
    {!inside ? <Text>{previous?.status === 'IN' ? `Last wear: ${retainerDuration(latest.timestamp - previous.timestamp)}` : 'No wear recorded'}</Text> : null}
    <Text>{reminderEnabled ? `${inside ? 'Morning reminder' : 'Next reminder'}: ${new Date(reminder).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Reminders off'}</Text>
    {error ? <Text>{error}</Text> : null}<Spacer />
    <Button label="Edit In/Out Times" onPress={() => router.push({ pathname: '/edit-times', params: { timeline: 'retainer', periodId: snapshot.period.id } })} />
  </VStack></Host>;
}
