import { MaterialIcons } from '@expo/vector-icons';
import { useContext } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  SlideInUp,
  SlideOutUp,
} from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { AppText } from '@/src/components/primitives';
import { radii, spacing, useIgnisTheme } from '@/src/theme/tokens';

export type ToastType = 'success' | 'danger' | 'warning' | 'info';

export type ToastAction = {
  label: string;
  onPress: () => void;
};

export type ToastItem = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  action?: ToastAction;
  duration?: number;
  icon?: keyof typeof MaterialIcons.glyphMap;
};

export function IgnisToastItem({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const theme = useIgnisTheme();

  // Gesture responder for swipe up to dismiss
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return gestureState.dy < -6;
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy < -15 || gestureState.vy < -0.5) {
        onDismiss(item.id);
      }
    },
  });

  const getStatusConfig = () => {
    switch (item.type) {
      case 'success':
        return {
          icon: item.icon ?? 'check-circle',
          color: theme.colors.success,
          defaultTitle: 'Success',
        };
      case 'danger':
        return {
          icon: item.icon ?? 'error',
          color: theme.colors.danger,
          defaultTitle: 'Error',
        };
      case 'warning':
        return {
          icon: item.icon ?? 'warning',
          color: theme.colors.accent,
          defaultTitle: 'Warning',
        };
      case 'info':
      default:
        return {
          icon: item.icon ?? 'info',
          color: theme.colors.instrumentLine,
          defaultTitle: 'Notice',
        };
    }
  };

  const status = getStatusConfig();

  return (
    <Animated.View
      entering={SlideInUp.duration(240).easing(Easing.out(Easing.cubic))}
      exiting={SlideOutUp.duration(180).easing(Easing.in(Easing.cubic))}
      style={styles.toastWrap}
      {...panResponder.panHandlers}
    >
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.toastCard,
          {
            backgroundColor: theme.colors.surfaceStrong,
            borderColor: theme.colors.instrumentLine,
          },
        ]}
      >
        {/* Left Status Color Rail */}
        <View style={[styles.statusRail, { backgroundColor: status.color }]} />

        <View style={styles.contentWrap}>
          {/* Icon */}
          <MaterialIcons color={status.color} name={status.icon} size={22} style={styles.icon} />

          {/* Texts */}
          <View style={styles.textColumn}>
            {item.title ? (
              <AppText
                variant="label"
                style={[styles.title, { color: theme.colors.onSurfaceStrong }]}
              >
                {item.title}
              </AppText>
            ) : null}
            <AppText
              variant="body"
              style={[
                styles.message,
                {
                  color: theme.colors.onSurfaceStrong,
                  fontSize: item.title ? 13 : 14,
                },
              ]}
            >
              {item.message}
            </AppText>
          </View>

          {/* Action Button */}
          {item.action ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                item.action?.onPress();
                onDismiss(item.id);
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  borderColor: theme.colors.onSurfaceStrongMuted,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <AppText
                variant="label"
                style={[styles.actionLabel, { color: theme.colors.onSurfaceStrong }]}
              >
                {item.action.label}
              </AppText>
            </Pressable>
          ) : null}

          {/* Close Tap */}
          <Pressable
            accessibilityLabel="Dismiss toast"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onDismiss(item.id)}
            style={styles.closeBtn}
          >
            <MaterialIcons
              color={theme.colors.onSurfaceStrongMuted}
              name="close"
              size={18}
            />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          top: insets.top + spacing.sm,
        },
      ]}
    >
      {toasts.map((toast) => (
        <IgnisToastItem key={toast.id} item={toast} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 9999,
    gap: spacing.sm,
  },
  toastWrap: {
    width: '100%',
    maxWidth: 440,
  },
  toastCard: {
    width: '100%',
    borderRadius: radii.md,
    borderWidth: 1.5,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    ...Platform.select({
      android: { elevation: 6 },
      web: { boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)' },
    }),
  },
  statusRail: {
    width: 5,
    alignSelf: 'stretch',
  },
  contentWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  icon: {
    marginRight: spacing.xs,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  message: {
    lineHeight: 18,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
  },
  closeBtn: {
    padding: spacing.xs,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
