import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, Text, View } from 'react-native';
// Avoid the legacy entry point's broken, eagerly evaluated theme exports.
import AwesomeButton from 'react-native-really-awesome-button/lib/commonjs/Button';
import { useAppTheme } from '@/theme/use-app-theme';

type Props = {
  status: 'IN' | 'OUT';
  saving: boolean;
  disabled: boolean;
  imageUri?: string;
  outDuration: string;
  subject?: 'Trays' | 'Retainers';
  showDuration?: boolean;
  onPress: () => void;
};

/** Branch-only React Native island inside the tracker's SwiftUI RNHostView. */
export function ExperimentalTrayButton({ status, saving, disabled, imageUri, outDuration, subject = 'Trays', showDuration = status === 'OUT', onPress }: Props) {
  const theme = useAppTheme();
  const [height, setHeight] = useState(124);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      receivedEvent = true;
      setReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active && !receivedEvent) setReduceMotion(enabled);
    }).catch(() => { /* Keep the motion-free default when unavailable. */ });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const isIn = status === 'IN';
  const isDisabled = disabled || saving;
  const color = isIn ? theme.onPrimary : theme.text;
  const hint = saving ? 'Saving the tracker change.' : `Tap when ${subject.toLowerCase()} are ${isIn ? 'removed' : 'inserted'}.`;
  // Outer bevel (3 + 2) and recessed seat (1 + 3) stay inside the allocation.
  const rimInset = 9;
  const buttonHeight = Math.max(0, height - rimInset * 2);
  // Let the illustration shrink first so the control fits the SwiftUI allocation.
  const imageHeight = Math.max(0, Math.min(195, buttonHeight - 160));

  return (
    <View
      style={{
        flex: 1,
        minHeight: 124,
        borderRadius: 37,
        borderWidth: 3,
        borderTopColor: 'rgba(255,255,255,0.45)',
        borderLeftColor: 'rgba(255,255,255,0.25)',
        borderRightColor: 'rgba(0,0,0,0.25)',
        borderBottomColor: 'rgba(0,0,0,0.45)',
        backgroundColor: theme.border,
        padding: 2,
      }}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
      <View style={{
        flex: 1,
        borderRadius: 32,
        borderWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.55)',
        borderLeftColor: 'rgba(0,0,0,0.35)',
        borderRightColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(255,255,255,0.25)',
        backgroundColor: theme.background,
        padding: 3,
      }}>
        <AwesomeButton
          stretch
          height={buttonHeight}
          borderRadius={28}
          raiseLevel={reduceMotion ? 0 : 7}
          springRelease={!reduceMotion}
          backgroundColor={isIn ? theme.primary : theme.surface}
          backgroundDarker={isIn ? theme.primaryPressed : theme.border}
          backgroundShadow="transparent"
          backgroundActive={reduceMotion ? 'transparent' : 'rgba(0,0,0,0.06)'}
          disabled={isDisabled}
          debouncedPressTime={0}
          progress={false}
          paddingHorizontal={12}
          // v2.0.4 invokes its onPress from onPressOut, including cancelled gestures.
          // Leave that callback empty; Pressable.onPress is the sole mutation entry.
          dangerouslySetPressableProps={{
            testID: 'experimental-tray-button',
            disabled: isDisabled,
            onPress: () => { if (!isDisabled) onPress(); },
            accessible: true,
            accessibilityRole: 'button',
            accessibilityLabel: subject === 'Trays' ? 'Aligner trays' : 'Retainers',
            accessibilityValue: { text: `${status}${saving ? ', saving' : ''}` },
            accessibilityHint: hint,
            accessibilityState: { disabled: isDisabled, busy: saving },
          }}>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {imageUri && imageHeight > 0 ? (
              <Image source={{ uri: imageUri }} resizeMode="contain"
                style={{ width: '100%', maxWidth: 260, height: imageHeight }} />
            ) : null}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
              style={{ color, fontSize: 22, fontWeight: '700' }}>{`${subject.toUpperCase()} ARE ${status}`}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
              style={{ color, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'], opacity: showDuration ? 1 : 0 }}>
              {outDuration}
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
              style={{ color, fontSize: 17 }}>{saving ? 'Saving…' : isIn ? 'Tap when removed' : 'Tap when inserted'}</Text>
          </View>
        </AwesomeButton>
      </View>
    </View>
  );
}
