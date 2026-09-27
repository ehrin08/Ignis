import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { ConfirmationDialog, IgnisModal } from '@/src/components/ignis-modal';
import {
  FeedbackProvider,
  useConfirm,
  useDialog,
  useToast,
} from '@/src/providers/feedback-provider';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  const dummyAnim = {
    duration: function() { return this; },
    easing: function() { return this; },
    delay: function() { return this; },
    springify: function() { return this; },
    damping: function() { return this; },
  };
  return {
    __esModule: true,
    default: {
      View,
      Text: require('react-native').Text,
      ScrollView: require('react-native').ScrollView,
      createAnimatedComponent: (v: any) => v,
    },
    Easing: {
      out: () => ({}),
      in: () => ({}),
      inOut: () => ({}),
      cubic: {},
      ease: {},
      linear: {},
    },
    FadeIn: dummyAnim,
    FadeOut: dummyAnim,
    ZoomInEasyDown: dummyAnim,
    ZoomOutEasyUp: dummyAnim,
    SlideInUp: dummyAnim,
    SlideOutUp: dummyAnim,
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn(),
    interpolateColor: jest.fn(),
    interpolate: jest.fn(),
    useAnimatedRef: jest.fn(),
    useScrollOffset: jest.fn(() => ({ value: 0 })),
  };
});

function TestConsumer() {
  const toast = useToast();
  const confirm = useConfirm();
  const { showChoice } = useDialog();

  return (
    <View>
      <Pressable onPress={() => toast.success('Settings updated successfully', 'Saved', { duration: 0 })}>
        <Text>Trigger Toast</Text>
      </Pressable>
      <Pressable
        onPress={async () => {
          const res = await confirm({
            title: 'Delete this entry?',
            message: 'This cannot be undone.',
            confirmText: 'Delete',
            destructive: true,
          });
          if (res) {
            toast.info('Item was deleted', undefined, { duration: 0 });
          }
        }}
      >
        <Text>Trigger Confirm</Text>
      </Pressable>
      <Pressable
        onPress={async () => {
          const choice = await showChoice({
            title: 'Select scope',
            buttons: [
              { text: 'Single', value: 'single' },
              { text: 'Future', value: 'future', kind: 'danger' },
            ],
          });
          if (choice) {
            toast.info(`Chosen: ${choice}`, undefined, { duration: 0 });
          }
        }}
      >
        <Text>Trigger MultiChoice</Text>
      </Pressable>
    </View>
  );
}

describe('Feedback System (Modals & Toast)', () => {
  test('renders IgnisModal with title and children', async () => {
    const onClose = jest.fn();
    const result = await render(
      <IgnisModal title="Custom Modal Title" visible={true} onClose={onClose}>
        <Text>Modal child content</Text>
      </IgnisModal>
    );

    expect(await result.findByText('Custom Modal Title')).toBeTruthy();
    expect(await result.findByText('Modal child content')).toBeTruthy();
  });

  test('renders ConfirmationDialog with buttons and fires onPress', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();

    const result = await render(
      <ConfirmationDialog
        title="Are you sure?"
        message="Please confirm your action."
        visible={true}
        buttons={[
          { text: 'Cancel', style: 'cancel', onPress: onCancel },
          { text: 'Proceed', kind: 'filled', onPress: onConfirm },
        ]}
      />
    );

    expect(await result.findByText('Are you sure?')).toBeTruthy();
    expect(await result.findByText('Please confirm your action.')).toBeTruthy();

    fireEvent.press(await result.findByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.press(await result.findByText('Proceed'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('triggers toast notifications via useToast and manual dismiss', async () => {
    const result = await render(
      <FeedbackProvider>
        <TestConsumer />
      </FeedbackProvider>
    );

    const triggerBtn = await result.findByText('Trigger Toast');
    fireEvent.press(triggerBtn);

    expect(await result.findByText('Saved')).toBeTruthy();
    expect(await result.findByText('Settings updated successfully')).toBeTruthy();

    const closeBtn = await result.findByLabelText('Dismiss toast');
    fireEvent.press(closeBtn);

    await waitFor(() => {
      expect(result.queryByText('Settings updated successfully')).toBeNull();
    });
  });

  test('resolves useConfirm promise when user confirms or cancels', async () => {
    const result = await render(
      <FeedbackProvider>
        <TestConsumer />
      </FeedbackProvider>
    );

    const triggerConfirm = await result.findByText('Trigger Confirm');
    fireEvent.press(triggerConfirm);

    expect(await result.findByText('Delete this entry?')).toBeTruthy();
    expect(await result.findByText('This cannot be undone.')).toBeTruthy();

    // Press Delete
    const deleteBtn = await result.findByText('Delete');
    fireEvent.press(deleteBtn);

    // Should resolve confirm and trigger subsequent toast
    expect(await result.findByText('Item was deleted')).toBeTruthy();
  });

  test('resolves showChoice dialog promise with selected value', async () => {
    const result = await render(
      <FeedbackProvider>
        <TestConsumer />
      </FeedbackProvider>
    );

    const triggerChoice = await result.findByText('Trigger MultiChoice');
    fireEvent.press(triggerChoice);

    expect(await result.findByText('Select scope')).toBeTruthy();
    expect(await result.findByText('Single')).toBeTruthy();
    expect(await result.findByText('Future')).toBeTruthy();

    const futureOption = await result.findByText('Future');
    fireEvent.press(futureOption);

    expect(await result.findByText('Chosen: future')).toBeTruthy();
  });
});
