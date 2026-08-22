import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { isSupportEnabled } from '@/config/support-config';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { resetAppData } from '@/features/reset/reset-app-repository';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type MenuItemProps = {
  destructive?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  showChevron?: boolean;
};

function MenuItem({
  destructive = false,
  disabled = false,
  label,
  onPress,
  showChevron = true,
}: MenuItemProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: pressed ? theme.border : theme.surface,
          borderColor: theme.border,
          opacity: disabled ? 0.6 : 1,
        },
      ]}>
      <AppText style={[styles.menuItemLabel, destructive && { color: theme.error }]}>
        {label}
      </AppText>
      {showChevron ? <AppText muted>›</AppText> : null}
    </Pressable>
  );
}

export function MenuScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const resetInProgress = useRef(false);
  const [isResetting, setIsResetting] = useState(false);

  async function resetApp() {
    if (resetInProgress.current) {
      return;
    }

    resetInProgress.current = true;
    setIsResetting(true);

    try {
      await resetAppData(db);
      await reconcileLocalNotifications(db);
      router.replace('/setup');
    } catch {
      resetInProgress.current = false;
      setIsResetting(false);
      Alert.alert('Reset failed', 'Your app data could not be reset. Please try again.');
    }
  }

  function confirmReset() {
    Alert.alert(
      'Reset App?',
      'This action will delete all the data you created in the app. It can not be undone.',
      [
        { style: 'cancel', text: 'Cancel' },
        { onPress: () => void resetApp(), style: 'destructive', text: 'Reset' },
      ],
    );
  }

  return (
    <AppScreen scrollable>
      <View style={styles.menuItems}>
        <MenuItem label="Account" onPress={() => router.push('/account')} />
        <MenuItem label="Treatment Plan" onPress={() => router.push('/treatment-plan')} />
        <MenuItem label="Notifications" onPress={() => router.push('/notifications')} />
        <MenuItem
          label="Edit In/Out Times"
          onPress={() => router.push('/edit-times')}
        />
        <MenuItem label="Statistics" onPress={() => router.push('/statistics')} />
        {isSupportEnabled ? (
          <MenuItem
            label="Support Aligner Tracker (Preview)"
            onPress={() => router.push('/support')}
          />
        ) : null}
        <MenuItem label="Help" onPress={() => router.push('/help')} />
        <MenuItem
          destructive
          disabled={isResetting}
          label={isResetting ? 'Resetting App…' : 'Reset App'}
          onPress={confirmReset}
          showChevron={false}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  menuItem: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  menuItemLabel: {
    fontWeight: '700',
  },
  menuItems: {
    gap: spacing.md,
  },
});
