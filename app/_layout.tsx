import { Doto_700Bold } from '@expo-google-fonts/doto/700Bold';
import { Doto_800ExtraBold } from '@expo-google-fonts/doto/800ExtraBold';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import 'react-native-reanimated';

import { ActionButton, AppText } from '@/src/components/primitives';
import { migrateDatabase } from '@/src/data/migrations';
import { AppDataProvider } from '@/src/providers/app-provider';
import { useIgnisTheme } from '@/src/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const ignisTheme = useIgnisTheme();
  const [fontsLoaded, fontError] = useFonts({ Doto_700Bold, Doto_800ExtraBold });
  const [databaseError, setDatabaseError] = useState<Error | null>(null);
  const [databaseKey, setDatabaseKey] = useState(0);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  if (databaseError) {
    return (
      <View style={[styles.databaseError, { backgroundColor: ignisTheme.colors.background }]}>
        <AppText variant="title">The schedule did not open</AppText>
        <AppText variant="muted" style={styles.databaseErrorCopy}>{databaseError.message}</AppText>
        <ActionButton label="Try database again" onPress={() => { setDatabaseError(null); setDatabaseKey((value) => value + 1); }} />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <SQLiteProvider databaseName="ignis.db" key={databaseKey} onError={setDatabaseError} onInit={migrateDatabase}>
      <AppDataProvider>
        <ThemeProvider value={{
          ...(colorScheme === 'dark' ? DarkTheme : DefaultTheme),
          colors: {
            ...(colorScheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
            primary: ignisTheme.colors.accent,
            background: ignisTheme.colors.background,
            card: ignisTheme.colors.background,
            text: ignisTheme.colors.ink,
            border: ignisTheme.colors.outline,
            notification: ignisTheme.colors.accent,
          },
        }}>
          <Stack screenOptions={{ headerBackTitle: 'Back' }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="schedule/[id]" options={{ title: 'Schedule entry', presentation: 'card' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AppDataProvider>
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  databaseError: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  databaseErrorCopy: { textAlign: 'center' },
});
