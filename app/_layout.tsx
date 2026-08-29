import { Doto_700Bold } from '@expo-google-fonts/doto/700Bold';
import { Doto_800ExtraBold } from '@expo-google-fonts/doto/800ExtraBold';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Component, PropsWithChildren, ReactNode, Suspense, useEffect, useState } from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import 'react-native-reanimated';

import { ActionButton, AppText } from '@/src/components/primitives';
import { migrateDatabase } from '@/src/data/migrations';
import { AppDataProvider } from '@/src/providers/app-provider';
import { useIgnisTheme } from '@/src/theme/tokens';

SplashScreen.preventAutoHideAsync();

type DatabaseErrorBoundaryProps = PropsWithChildren<{
  renderError: (error: Error) => ReactNode;
}>;

class DatabaseErrorBoundary extends Component<DatabaseErrorBoundaryProps, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(cause: unknown) {
    return {
      error: cause instanceof Error ? cause : new Error('Ignis could not open its local database.'),
    };
  }

  render() {
    return this.state.error ? this.props.renderError(this.state.error) : this.props.children;
  }
}

function DatabaseErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const ignisTheme = useIgnisTheme();
  return (
    <View style={[styles.databaseError, { backgroundColor: ignisTheme.colors.background }]}>
      <AppText variant="title">The schedule did not open</AppText>
      <AppText variant="muted" style={styles.databaseErrorCopy}>{error.message}</AppText>
      <ActionButton label="Try database again" onPress={onRetry} />
      <StatusBar style="auto" />
    </View>
  );
}

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

  const app = (
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
  );

  if (Platform.OS === 'web') {
    return (
      <DatabaseErrorBoundary renderError={(error) => (
        <DatabaseErrorScreen error={error} onRetry={() => window.location.reload()} />
      )}>
        <Suspense fallback={null}>
          <SQLiteProvider databaseName="ignis.db" onInit={migrateDatabase} useSuspense>
            {app}
          </SQLiteProvider>
        </Suspense>
      </DatabaseErrorBoundary>
    );
  }

  if (databaseError) {
    return (
      <DatabaseErrorScreen
        error={databaseError}
        onRetry={() => { setDatabaseError(null); setDatabaseKey((value) => value + 1); }}
      />
    );
  }

  return (
    <SQLiteProvider databaseName="ignis.db" key={databaseKey} onError={setDatabaseError} onInit={migrateDatabase}>
      {app}
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  databaseError: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  databaseErrorCopy: { textAlign: 'center' },
});
