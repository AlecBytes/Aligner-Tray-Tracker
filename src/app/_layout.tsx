import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppDatabaseProvider } from '@/db/database-provider';
import { CloudAuthInitializer } from '@/features/cloud-auth/cloud-auth-initializer';
import { NotificationInitializer } from '@/features/notifications/notification-initializer';

void SplashScreen.preventAutoHideAsync();

function DatabaseReady({ children }: React.PropsWithChildren) {
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    void SplashScreen.hideAsync().finally(() => setSplashHidden(true));
  }, []);

  return splashHidden ? children : null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AppDatabaseProvider fallback={<AppLoadingScreen />}>
      <DatabaseReady>
        <CloudAuthInitializer />
        <NotificationInitializer />
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </DatabaseReady>
    </AppDatabaseProvider>
  );
}
