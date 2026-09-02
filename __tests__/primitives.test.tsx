import { act, render } from '@testing-library/react-native';
import { RefreshControl, Text } from 'react-native';

import { Screen } from '@/src/components/primitives';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));

describe('Screen primitive', () => {
  test('renders children in non-scroll mode', async () => {
    const result = await render(
      <Screen>
        <Text>Content</Text>
      </Screen>,
    );
    expect(result.getByText('Content')).toBeTruthy();
  });

  test('renders children with ScrollView in scroll mode', async () => {
    const result = await render(
      <Screen scroll>
        <Text>Scrollable Content</Text>
      </Screen>,
    );
    expect(result.getByText('Scrollable Content')).toBeTruthy();
  });

  test('configures RefreshControl and executes onRefresh callback', async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const result = await render(
      <Screen scroll onRefresh={onRefresh}>
        <Text>Refreshable Content</Text>
      </Screen>,
    );

    const scrollView = result.getByTestId('screen-scroll-view');
    expect(scrollView.props.refreshControl).toBeTruthy();
    expect(scrollView.props.refreshControl.props.refreshing).toBe(false);

    await act(async () => {
      await scrollView.props.refreshControl.props.onRefresh();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('honors controlled refreshing prop', async () => {
    const onRefresh = jest.fn();
    const result = await render(
      <Screen scroll onRefresh={onRefresh} refreshing={true}>
        <Text>Controlled Refreshing</Text>
      </Screen>,
    );

    const scrollView = result.getByTestId('screen-scroll-view');
    expect(scrollView.props.refreshControl.props.refreshing).toBe(true);
  });
});
