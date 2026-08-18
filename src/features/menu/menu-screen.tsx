import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type MenuItemProps = {
  label: string;
  onPress: () => void;
};

function MenuItem({ label, onPress }: MenuItemProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: pressed ? theme.border : theme.surface,
          borderColor: theme.border,
        },
      ]}>
      <AppText style={styles.menuItemLabel}>{label}</AppText>
      <AppText muted>›</AppText>
    </Pressable>
  );
}

export function MenuScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <View style={styles.menuItems}>
        <MenuItem label="Account" onPress={() => router.push('/account')} />
        <MenuItem label="Treatment Plan" onPress={() => router.push('/treatment-plan')} />
        <MenuItem label="Notifications" onPress={() => router.push('/notifications')} />
        <MenuItem
          label="Edit In/Out Times"
          onPress={() => router.push('/edit-times')}
        />
        <MenuItem label="Statistics" onPress={() => router.push('/statistics')} />
        {__DEV__ ? (
          <MenuItem
            label="Support Aligner Tracker (Preview)"
            onPress={() => router.push('/support')}
          />
        ) : null}
        <MenuItem label="Help" onPress={() => router.push('/help')} />
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
