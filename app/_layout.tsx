import { Doto_700Bold } from '@expo-google-fonts/doto/700Bold';
import { Doto_800ExtraBold } from '@expo-google-fonts/doto/800ExtraBold';
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Component, PropsWithChildren, ReactNode, Suspense, useEffect, useState } from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import 'react-native-reanimated';

import { ActionButton, AppText } from '@/src/components/primitives';
import { migrateDatabase } from '@/src/data/migrations';
import { AppDataProvider } from '@/src/providers/app-provider';
import { BudgetProvider } from '@/src/providers/budget-provider';
import { FeedbackProvider } from '@/src/providers/feedback-provider';
import { useIgnisTheme } from '@/src/theme/tokens';
import { clearWebOpfsStorage, getDatabaseErrorInfo } from '@/src/utils/web-storage';

// Notification foreground handler — show alerts even when app is open
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
if (!isExpoGo) {
  try {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Ignore in Expo Go where push notifications are unsupported in SDK 53+
  }
}

// Widget task handler (Android only, headless)
if (Platform.OS === 'android') {
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    const { widgetTaskHandler } = require('@/src/widget/task-handler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    // Native module unavailable — skip
  }
}


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

function DatabaseErrorScreen({
  error,
  onRetry,
  onUseMemoryMode,
  onResetStorage,
}: {
  error: Error;
  onRetry: () => void;
  onUseMemoryMode?: () => void;
  onResetStorage?: () => Promise<void>;
}) {
  const ignisTheme = useIgnisTheme();
  const [resetting, setResetting] = useState(false);
  const info = getDatabaseErrorInfo(error);

  const handleReset = async () => {
    if (!onResetStorage) return;
    setResetting(true);
    try {
      await onResetStorage();
    } finally {
      setResetting(false);
    }
  };

  return (
    <View style={[styles.databaseError, { backgroundColor: ignisTheme.colors.background }]}>
      <View
        style={[
          styles.databaseErrorCard,
          {
            borderColor: ignisTheme.colors.outline,
            backgroundColor: ignisTheme.colors.surface,
          },
        ]}
      >
        <AppText variant="title" style={styles.databaseErrorTitle}>
          {info.title}
        </AppText>
        <AppText variant="muted" style={styles.databaseErrorCopy}>
          {info.description}
        </AppText>

        {info.isLockError ? (
          <View style={[styles.lockBadge, { backgroundColor: ignisTheme.colors.surfaceStrong }]}>
            <AppText variant="label" style={{ color: ignisTheme.colors.background, fontSize: 11 }}>
              Single-Tab Storage Active
            </AppText>
          </View>
        ) : null}

        <View style={styles.buttonStack}>
          <ActionButton
            label={info.isLockError ? 'Close Other Tabs & Retry' : 'Try database again'}
            onPress={onRetry}
          />
          {onUseMemoryMode ? (
            <ActionButton
              kind="outlined"
              label="Continue in Temporary Mode"
              onPress={onUseMemoryMode}
            />
          ) : null}
          {onResetStorage ? (
            <ActionButton
              disabled={resetting}
              kind="outlined"
              label={resetting ? 'Resetting storage...' : 'Reset Web Storage'}
              onPress={handleReset}
            />
          ) : null}
        </View>
      </View>
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
  const [useMemoryDb, setUseMemoryDb] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  const app = (
    <AppDataProvider>
      <FeedbackProvider>
        <ThemeProvider
          value={{
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
          }}
        >
          <BudgetProvider>
            <Stack screenOptions={{ headerBackTitle: 'Back' }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="account" options={{ title: 'Account & sync', presentation: 'card' }} />
              <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
              <Stack.Screen name="schedule/[id]" options={{ title: 'Schedule entry', presentation: 'card' }} />
              <Stack.Screen name="budget/entry/[id]" options={{ title: 'Budget entry', presentation: 'card' }} />
              <Stack.Screen name="budget/categories" options={{ title: 'Expense categories', presentation: 'card' }} />
              <Stack.Screen name="budget/category/[id]" options={{ title: 'Category', presentation: 'card' }} />
            </Stack>
            <StatusBar style="auto" />
          </BudgetProvider>
        </ThemeProvider>
      </FeedbackProvider>
    </AppDataProvider>
  );

  const dbName = useMemoryDb ? ':memory:' : 'ignis.db';

  if (Platform.OS === 'web') {
    return (
      <DatabaseErrorBoundary
        key={`${dbName}-${databaseKey}`}
        renderError={(error) => (
          <DatabaseErrorScreen
            error={error}
            onResetStorage={async () => {
              await clearWebOpfsStorage();
              if (typeof window !== 'undefined') {
                window.location.reload();
              } else {
                setDatabaseError(null);
                setDatabaseKey((value) => value + 1);
              }
            }}
            onRetry={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              } else {
                setDatabaseError(null);
                setDatabaseKey((value) => value + 1);
              }
            }}
            onUseMemoryMode={() => {
              setDatabaseError(null);
              setUseMemoryDb(true);
              setDatabaseKey((value) => value + 1);
            }}
          />
        )}
      >
        <Suspense fallback={null}>
          <SQLiteProvider databaseName={dbName} key={`${dbName}-${databaseKey}`} onInit={migrateDatabase} useSuspense>
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
        onRetry={() => {
          setDatabaseError(null);
          setDatabaseKey((value) => value + 1);
        }}
      />
    );
  }

  return (
    <SQLiteProvider databaseName={dbName} key={`${dbName}-${databaseKey}`} onError={setDatabaseError} onInit={migrateDatabase}>
      {app}
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  databaseError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  databaseErrorCard: {
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  databaseErrorTitle: {
    textAlign: 'center',
  },
  databaseErrorCopy: {
    textAlign: 'center',
    lineHeight: 22,
  },
  lockBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonStack: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
});
