import { Alert, Button, ScrollView, Switch, Text, TextInput } from 'react-native';
import { disableMessage, enableMessage, useRetainerSettings } from './use-retainer-settings';
export function RetainerSettingsScreen() {
  const { settings, mode, error, busy, switchMode, save } = useRetainerSettings(); const active = mode?.kind === 'retainer';
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}><Text>Retainer Mode is for after active aligner treatment is complete. It replaces tray progression with nighttime retainer reminders and wear tracking.</Text>
    <Button title={active ? 'Turn off Retainer Mode' : 'Enable Retainer Mode'} disabled={busy} onPress={() => Alert.alert(active ? 'Leave Retainer Mode?' : 'Complete current treatment?', active ? disableMessage : enableMessage, [{ text: 'Cancel', style: 'cancel' }, { text: active ? 'Turn Off & Set Up Treatment' : 'Complete Treatment & Enable', onPress: () => void switchMode() }])} />
    {settings ? (['bedtime', 'morning', 'automatic'] as const).map((kind) => <ScrollView key={kind}><Text>{kind === 'automatic' ? 'Automatically mark retainers OUT' : `${kind} reminder`}</Text><Switch disabled={!active || busy} value={!!settings[`${kind}_enabled`]} onValueChange={(value) => void save({ ...settings, [`${kind}_enabled`]: +value })} /><TextInput accessibilityLabel={`${kind} time in HH:MM format`} editable={active && !busy} defaultValue={`${Math.floor(settings[`${kind}_minutes`] / 60)}:${String(settings[`${kind}_minutes`] % 60).padStart(2, '0')}`} onEndEditing={({ nativeEvent }) => { const match = /^(\d{1,2}):(\d{2})$/.exec(nativeEvent.text); if (match && +match[1] < 24 && +match[2] < 60) void save({ ...settings, [`${kind}_minutes`]: +match[1] * 60 + +match[2] }); }} /></ScrollView>) : null}
    <Text>Assume retainers are OUT at this time if they are still marked IN.</Text>{error ? <Text>{error}</Text> : null}
  </ScrollView>;
}
