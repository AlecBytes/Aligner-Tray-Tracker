import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppDatabaseProvider } from '@/db/database-provider';
import { CloudAuthInitializer } from '@/features/cloud-auth/cloud-auth-initializer';
import { NotificationInitializer } from '@/features/notifications/notification-initializer';
import { PaidAccessProvider } from '@/features/paid-access/paid-access-provider';
import { AppThemeProvider } from '@/theme/app-theme-provider';
import { useAppTheme } from '@/theme/use-app-theme';

void SplashScreen.preventAutoHideAsync();

function DatabaseReady({ children }: React.PropsWithChildren) {
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    void SplashScreen.hideAsync().finally(() => setSplashHidden(true));
  }, []);

  return splashHidden ? children : null;
}

function AppShell() {
  const colorScheme = useColorScheme();
  const appTheme = useAppTheme();
  const routerTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...routerTheme,
        colors: {
          ...routerTheme.colors,
          background: appTheme.background,
          border: appTheme.border,
          card: appTheme.surface,
          primary: appTheme.primary,
          text: appTheme.text,
        },
      }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="restore"
          options={{
            headerBackButtonDisplayMode: 'minimal',
            headerShown: true,
            title: 'Restore Backup',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppDatabaseProvider fallback={<AppLoadingScreen />}>
      <DatabaseReady>
        <PaidAccessProvider>
          <AppThemeProvider>
            <CloudAuthInitializer />
            <NotificationInitializer />
            <AppShell />
          </AppThemeProvider>
        </PaidAccessProvider>
      </DatabaseReady>
    </AppDatabaseProvider>
  );
}
