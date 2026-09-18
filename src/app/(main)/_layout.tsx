import { useTrackingMode } from '@/features/retainer/use-tracking-mode';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { releaseFeatures } from '@/config/release-features';
import { TreatmentRouteGate } from '@/features/treatment/treatment-route-gate';
import { useAppTheme } from '@/theme/use-app-theme';

export default function MainLayout() {
  const theme = useAppTheme();
  const { mode } = useTrackingMode();
  const retainer = mode?.kind === 'retainer';

  return (
    <TreatmentRouteGate whenMissing="/setup">
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.background },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}>
        <Stack.Screen name="tracker" options={{ headerShown: false }} />
        <Stack.Screen name="intervals" redirect={retainer} options={{ title: 'Today’s Intervals' }} />
        <Stack.Screen name="change-tray" redirect={retainer} options={{ title: 'Change Tray' }} />
        <Stack.Screen name="retainer-mode" options={{ title: 'Retainer Mode' }} />
        <Stack.Screen name="menu" options={{ title: 'Menu' }} />
        <Stack.Screen
          name="account"
          redirect={!releaseFeatures.cloudBackup}
          options={{ title: Platform.OS === 'ios' ? 'Cloud Backup' : 'Account' }}
        />
        <Stack.Screen name="treatment-plan" redirect={retainer} options={{ title: 'Treatment Plan' }} />
        <Stack.Screen name="treatment-plan-history" options={{ title: 'Plan History' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="edit-times" options={{ title: 'Edit In/Out Times' }} />
        <Stack.Screen name="statistics" options={{ title: 'Statistics' }} />
        <Stack.Screen name="statistics/graphs/index" options={{ title: 'Graphs' }} />
        <Stack.Screen name="statistics/graphs/[graph]" options={{ title: 'Graph' }} />
        <Stack.Screen name="share-progress" redirect={retainer} options={{ title: 'Share Progress' }} />
        <Stack.Screen name="support" options={{ title: 'Support Aligner Tracker' }} />
        <Stack.Screen name="themes" options={{ title: 'Themes' }} />
        <Stack.Screen
          name="premium"
          redirect={!releaseFeatures.paidAccess}
          options={{ presentation: 'modal', title: 'Premium' }}
        />
        <Stack.Screen
          name="premium-support"
          redirect={!releaseFeatures.paidAccess}
          options={{ title: 'Premium Support' }}
        />
        <Stack.Screen name="help" options={{ title: 'Help' }} />
      </Stack>
    </TreatmentRouteGate>
  );
}
