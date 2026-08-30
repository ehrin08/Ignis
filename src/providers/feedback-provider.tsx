import * as Haptics from 'expo-haptics';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import {
  ConfirmationDialog,
  DialogButton,
} from '@/src/components/ignis-modal';
import {
  ToastAction,
  ToastContainer,
  ToastItem,
  ToastType,
} from '@/src/components/ignis-toast';

export type ToastOptions = {
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
  action?: ToastAction;
  haptics?: boolean;
};

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  kind?: 'filled' | 'outlined' | 'danger';
  destructive?: boolean;
};

export type ChoiceButton<T> = {
  text: string;
  value: T;
  style?: 'default' | 'cancel' | 'destructive';
  kind?: 'filled' | 'outlined' | 'danger';
};

export type ChoiceOptions<T> = {
  title: string;
  message?: string;
  buttons: ChoiceButton<T>[];
  dismissValue?: T;
};

export type AlertOptions = {
  title: string;
  message?: string;
  buttonText?: string;
};

type ActiveDialog = {
  title: string;
  message?: string;
  buttons: DialogButton[];
  dismissOnBackdrop?: boolean;
  onDismiss: () => void;
};

export type ToastContextValue = {
  show: (options: ToastOptions) => string;
  success: (message: string, title?: string, options?: Partial<ToastOptions>) => string;
  error: (message: string, title?: string, options?: Partial<ToastOptions>) => string;
  warning: (message: string, title?: string, options?: Partial<ToastOptions>) => string;
  info: (message: string, title?: string, options?: Partial<ToastOptions>) => string;
  dismiss: (id: string) => void;
};

export type DialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showChoice: <T = string>(options: ChoiceOptions<T>) => Promise<T>;
  showAlert: (options: AlertOptions) => Promise<void>;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const DialogContext = createContext<DialogContextValue | null>(null);

export function FeedbackProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const triggerHaptic = useCallback(async (type: ToastType) => {
    if (Platform.OS === 'web') return;
    try {
      switch (type) {
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'danger':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'info':
        default:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
      }
    } catch {
      // Ignore haptics failure if unsupported on device
    }
  }, []);

  const showToast = useCallback(
    ({
      type = 'info',
      title,
      message,
      duration = 3200,
      action,
      haptics = true,
    }: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newItem: ToastItem = { id, type, title, message, action, duration };

      setToasts((prev) => [newItem, ...prev.slice(0, 2)]); // Keep at most 3 active toasts

      if (haptics) {
        triggerHaptic(type);
      }

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast, triggerHaptic]
  );

  const successToast = useCallback(
    (message: string, title?: string, options?: Partial<ToastOptions>) => {
      return showToast({ ...options, type: 'success', title, message });
    },
    [showToast]
  );

  const errorToast = useCallback(
    (message: string, title?: string, options?: Partial<ToastOptions>) => {
      return showToast({ ...options, type: 'danger', title, message });
    },
    [showToast]
  );

  const warningToast = useCallback(
    (message: string, title?: string, options?: Partial<ToastOptions>) => {
      return showToast({ ...options, type: 'warning', title, message });
    },
    [showToast]
  );

  const infoToast = useCallback(
    (message: string, title?: string, options?: Partial<ToastOptions>) => {
      return showToast({ ...options, type: 'info', title, message });
    },
    [showToast]
  );

  const confirm = useCallback(
    ({
      title,
      message,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      kind = 'filled',
      destructive = false,
    }: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        const resolvedKind = destructive ? 'danger' : kind;

        setActiveDialog({
          title,
          message,
          dismissOnBackdrop: true,
          onDismiss: () => {
            setActiveDialog(null);
            resolve(false);
          },
          buttons: [
            {
              text: cancelText,
              style: 'cancel',
              onPress: () => {
                setActiveDialog(null);
                resolve(false);
              },
            },
            {
              text: confirmText,
              kind: resolvedKind,
              style: destructive ? 'destructive' : 'default',
              onPress: () => {
                setActiveDialog(null);
                resolve(true);
              },
            },
          ],
        });
      });
    },
    []
  );

  const showChoice = useCallback(
    <T = string,>({
      title,
      message,
      buttons,
      dismissValue,
    }: ChoiceOptions<T>) => {
      return new Promise<T>((resolve) => {
        const defaultDismiss = dismissValue !== undefined ? dismissValue : (null as unknown as T);

        const dialogButtons: DialogButton[] = buttons.map((btn) => ({
          text: btn.text,
          style: btn.style,
          kind: btn.kind,
          onPress: () => {
            setActiveDialog(null);
            resolve(btn.value);
          },
        }));

        setActiveDialog({
          title,
          message,
          dismissOnBackdrop: true,
          onDismiss: () => {
            setActiveDialog(null);
            resolve(defaultDismiss);
          },
          buttons: dialogButtons,
        });
      });
    },
    []
  );

  const showAlert = useCallback(
    ({ title, message, buttonText = 'OK' }: AlertOptions) => {
      return new Promise<void>((resolve) => {
        setActiveDialog({
          title,
          message,
          dismissOnBackdrop: true,
          onDismiss: () => {
            setActiveDialog(null);
            resolve();
          },
          buttons: [
            {
              text: buttonText,
              kind: 'filled',
              onPress: () => {
                setActiveDialog(null);
                resolve();
              },
            },
          ],
        });
      });
    },
    []
  );

  const toastValue: ToastContextValue = {
    show: showToast,
    success: successToast,
    error: errorToast,
    warning: warningToast,
    info: infoToast,
    dismiss: dismissToast,
  };

  const dialogValue: DialogContextValue = {
    confirm,
    showChoice,
    showAlert,
  };

  return (
    <ToastContext.Provider value={toastValue}>
      <DialogContext.Provider value={dialogValue}>
        {children}
        <ToastContainer onDismiss={dismissToast} toasts={toasts} />
        {activeDialog && (
          <ConfirmationDialog
            buttons={activeDialog.buttons}
            dismissOnBackdrop={activeDialog.dismissOnBackdrop}
            message={activeDialog.message}
            onClose={activeDialog.onDismiss}
            title={activeDialog.title}
            visible={true}
          />
        )}
      </DialogContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a FeedbackProvider');
  }
  return context;
}

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a FeedbackProvider');
  }
  return context;
}

export function useConfirm() {
  const { confirm } = useDialog();
  return confirm;
}
