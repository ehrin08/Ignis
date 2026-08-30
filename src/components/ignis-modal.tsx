import { MaterialIcons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode, useEffect } from 'react';
import {
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomInEasyDown,
  ZoomOutEasyUp,
} from 'react-native-reanimated';

import { ActionButton, AppText } from '@/src/components/primitives';
import { radii, spacing, useIgnisTheme } from '@/src/theme/tokens';

export type DialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  kind?: 'filled' | 'outlined' | 'danger';
  onPress?: () => void | Promise<void>;
  loading?: boolean;
};

export type IgnisModalProps = PropsWithChildren<{
  visible: boolean;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  dismissOnBackdrop?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  headerRight?: ReactNode;
  footer?: ReactNode;
}>;

export function IgnisModal({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  iconColor,
  dismissOnBackdrop = true,
  contentStyle,
  headerRight,
  footer,
  children,
}: IgnisModalProps) {
  const theme = useIgnisTheme();

  useEffect(() => {
    if (!visible || !onClose) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dismissOnBackdrop) {
        onClose();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [visible, onClose, dismissOnBackdrop]);

  if (!visible) return null;

  return (
    <Modal
      animationType="none"
      hardwareAccelerated
      onRequestClose={() => {
        if (dismissOnBackdrop && onClose) onClose();
      }}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(150)}
        style={[
          styles.backdrop,
          {
            backgroundColor: theme.dark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(21, 22, 21, 0.55)',
          },
        ]}
      >
        <Pressable
          accessibilityLabel="Close dialog"
          accessibilityRole="button"
          onPress={() => {
            if (dismissOnBackdrop && onClose) onClose();
          }}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View
          entering={ZoomInEasyDown.duration(220)}
          exiting={ZoomOutEasyUp.duration(180)}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outlineStrong,
            },
            contentStyle,
          ]}
        >
          {/* Perforation bar visual hallmark */}
          <View style={styles.perforationBar}>
            {Array.from({ length: 12 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.perforationDot,
                  { backgroundColor: theme.colors.instrumentLine },
                ]}
              />
            ))}
          </View>

          {/* Header */}
          {(title || icon || headerRight) && (
            <View style={styles.header}>
              {icon && (
                <View
                  style={[
                    styles.iconCircle,
                    {
                      borderColor: iconColor ?? theme.colors.outline,
                      backgroundColor: theme.colors.surfaceRaised,
                    },
                  ]}
                >
                  <MaterialIcons
                    color={iconColor ?? theme.colors.ink}
                    name={icon}
                    size={22}
                  />
                </View>
              )}
              <View style={styles.headerText}>
                {title && <AppText variant="title" style={styles.title}>{title}</AppText>}
                {subtitle && (
                  <AppText variant="muted" style={styles.subtitle}>
                    {subtitle}
                  </AppText>
                )}
              </View>
              {headerRight}
            </View>
          )}

          {/* Body Content */}
          {children && <View style={styles.body}>{children}</View>}

          {/* Footer / Actions */}
          {footer && <View style={styles.footer}>{footer}</View>}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export type ConfirmationDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  buttons: DialogButton[];
  onClose?: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  dismissOnBackdrop?: boolean;
};

export function ConfirmationDialog({
  visible,
  title,
  message,
  buttons,
  onClose,
  icon,
  iconColor,
  dismissOnBackdrop = true,
}: ConfirmationDialogProps) {
  const theme = useIgnisTheme();

  const hasDestructive = buttons.some((btn) => btn.style === 'destructive' || btn.kind === 'danger');
  const resolvedIcon = icon ?? (hasDestructive ? 'warning-amber' : 'info-outline');
  const resolvedIconColor = iconColor ?? (hasDestructive ? theme.colors.danger : theme.colors.ink);

  const useVerticalStack = buttons.length > 2;

  return (
    <IgnisModal
      dismissOnBackdrop={dismissOnBackdrop}
      icon={resolvedIcon}
      iconColor={resolvedIconColor}
      onClose={onClose}
      title={title}
      visible={visible}
      footer={
        <View style={[styles.buttonContainer, useVerticalStack ? styles.buttonStack : styles.buttonRow]}>
          {buttons.map((button, index) => {
            let kind: 'filled' | 'outlined' | 'danger' = 'filled';
            if (button.kind) {
              kind = button.kind;
            } else if (button.style === 'destructive') {
              kind = 'danger';
            } else if (button.style === 'cancel') {
              kind = 'outlined';
            }

            return (
              <View
                key={`${button.text}-${index}`}
                style={useVerticalStack ? styles.stackedButtonWrap : styles.rowButtonWrap}
              >
                <ActionButton
                  kind={kind}
                  label={button.text}
                  loading={button.loading}
                  onPress={() => {
                    if (button.onPress) {
                      button.onPress();
                    }
                  }}
                  style={styles.actionBtn}
                />
              </View>
            );
          })}
        </View>
      }
    >
      {message && (
        <AppText variant="body" style={styles.messageText}>
          {message}
        </AppText>
      )}
    </IgnisModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1.5,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    ...Platform.select({
      android: { elevation: 6 },
      web: { boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)' },
    }),
  },
  perforationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginBottom: -spacing.xs,
  },
  perforationDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.45,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  body: {
    gap: spacing.md,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    marginTop: spacing.xs,
  },
  buttonContainer: {
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  buttonStack: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  rowButtonWrap: {
    flex: 1,
  },
  stackedButtonWrap: {
    width: '100%',
  },
  actionBtn: {
    minHeight: 48,
  },
});
