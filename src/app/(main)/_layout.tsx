import { Stack } from 'expo-router';

import { TreatmentRouteGate } from '@/features/treatment/treatment-route-gate';
import { useAppTheme } from '@/theme/use-app-theme';

export default function MainLayout() {
  const theme = useAppTheme();

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
        <Stack.Screen name="change-tray" options={{ title: 'Change Tray' }} />
        <Stack.Screen name="menu" options={{ title: 'Menu' }} />
        <Stack.Screen name="account" options={{ title: 'Account' }} />
        <Stack.Screen name="treatment-plan" options={{ title: 'Treatment Plan' }} />
        <Stack.Screen name="treatment-plan-history" options={{ title: 'Plan History' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="edit-times/index" options={{ title: 'Edit In/Out Times' }} />
        <Stack.Screen name="edit-times/day" options={{ title: 'Punch History' }} />
        <Stack.Screen name="edit-times/event" options={{ title: 'Edit Event' }} />
        <Stack.Screen name="edit-times/add" options={{ title: 'Add Missing Time' }} />
        <Stack.Screen name="statistics" options={{ title: 'Statistics' }} />
        <Stack.Screen name="support" options={{ title: 'Support Aligner Tracker' }} />
        <Stack.Screen name="help" options={{ title: 'Help' }} />
      </Stack>
    </TreatmentRouteGate>
  );
}
