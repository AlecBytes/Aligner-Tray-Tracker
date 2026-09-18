import { Alert, Button, DatePicker, Form, Host, Section, Text, Toggle } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { AppLoadingScreen } from '@/components/app-loading-screen';
import { useAppTheme } from '@/theme/use-app-theme';
import { disableMessage, enableMessage, useRetainerSettings } from './use-retainer-settings';
export function RetainerSettingsScreen() {
  const { settings, mode, error, busy, permission, switchMode, save } = useRetainerSettings();
  const [confirm, setConfirm] = useState(false); const theme = useAppTheme();
  if (!settings) return <AppLoadingScreen message={error ?? 'Loading settings…'} />;
  const active = mode?.kind === 'retainer';
  return <Host seedColor={theme.primary} style={{ flex: 1 }}><Form>
    <Section><Text>Retainer Mode is for after active aligner treatment is complete. It replaces tray progression with nighttime retainer reminders and wear tracking.</Text>
    <Alert title={active ? 'Leave Retainer Mode?' : 'Complete current treatment?'} isPresented={confirm} onIsPresentedChange={setConfirm}>
      <Alert.Trigger>
    <Toggle label="Retainer Mode" isOn={active} onIsOnChange={() => setConfirm(true)} modifiers={[disabled(busy || !mode || mode.kind === 'setup')]} />
      </Alert.Trigger>
      <Alert.Actions><Button label="Cancel" role="cancel" onPress={() => setConfirm(false)} /><Button label={active ? 'Turn Off & Set Up Treatment' : 'Complete Treatment & Enable'} onPress={() => { setConfirm(false); void switchMode(); }} /></Alert.Actions>
      <Alert.Message><Text>{active ? disableMessage : enableMessage}</Text></Alert.Message>
    </Alert></Section>
    {(['bedtime', 'morning', 'automatic'] as const).map((kind) => {
      const enabledKey = `${kind}_enabled` as const; const minutesKey = `${kind}_minutes` as const;
      const date = new Date(); date.setHours(Math.floor(settings[minutesKey] / 60), settings[minutesKey] % 60, 0, 0);
      return <Section key={kind} title={kind === 'bedtime' ? 'Bedtime Reminder' : kind === 'morning' ? 'Morning Reminder' : 'Automatic Morning OUT'}>
        <Toggle label={kind === 'automatic' ? 'Automatically mark retainers OUT' : 'Enabled'} isOn={!!settings[enabledKey]} onIsOnChange={(value) => void save({ ...settings, [enabledKey]: value ? 1 : 0 })} modifiers={[disabled(!active || busy)]} />
        <DatePicker title="Time" selection={date} displayedComponents={['hourAndMinute']} onDateChange={(value) => void save({ ...settings, [minutesKey]: value.getHours() * 60 + value.getMinutes() })} modifiers={[disabled(!active || busy || !settings[enabledKey])]} />
        {kind === 'automatic' ? <Text>Assume retainers are OUT at this time if they are still marked IN.</Text> : null}
      </Section>;
    })}
    {permission === 'denied' ? <Section><Text>Notifications are blocked by your device. Your reminder preferences are saved.</Text></Section> : null}
    {error ? <Section><Text>{error}</Text></Section> : null}
  </Form></Host>;
}
