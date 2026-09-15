import { Button, Form, HStack, Host, Rectangle, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHint, accessibilityLabel, buttonStyle, contentShape, foregroundStyle, frame, shapes } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { themeColors, themeKeys, themeNames, type ThemeKey } from '@/theme/tokens';
import { useAppTheme, useAppThemeState } from '@/theme/use-app-theme';
import { useColorScheme } from 'react-native';
import { ValidationMessage } from '@/components/expo-ui-components';

export function ThemesScreen() {
  const theme = useAppTheme(); const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'; const { savedThemeKey, selectTheme } = useAppThemeState(); const [error, setError] = useState<string | null>(null);
  async function choose(key: ThemeKey) { setError(null); try { await selectTheme(key); } catch { setError('Your theme could not be saved. Please try again.'); } }
  return <Host seedColor={theme.primary} style={{ flex: 1 }}><Form>
    <Section footer={<ValidationMessage message={error}/>}>
      {themeKeys.map((key) => { const selected = key === savedThemeKey; return <Button key={key} onPress={() => void choose(key)} modifiers={[buttonStyle('plain'), accessibilityLabel(`${themeNames[key]}, ${selected ? 'selected' : 'available'}`), accessibilityHint('Applies this theme')]}><HStack spacing={12} modifiers={[frame({ minHeight: 44, maxWidth: Infinity, alignment: 'leading' }), contentShape(shapes.rectangle())]}><Rectangle modifiers={[foregroundStyle(themeColors(key, scheme).primary), frame({ width: 30, height: 30 })]} /><Text>{themeNames[key]}</Text><Spacer/><Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{selected ? 'Selected' : ''}</Text></HStack></Button>; })}
    </Section>
    <Section title="Preview"><VStack alignment="leading" spacing={8}><Text>Selected accents apply to app actions and controls.</Text><HStack spacing={8}>{themeKeys.map((key) => <Rectangle key={key} modifiers={[foregroundStyle(themeColors(key, scheme).primary), frame({ width: 30, height: 18 })]}/>)}</HStack></VStack></Section>
  </Form></Host>;
}
