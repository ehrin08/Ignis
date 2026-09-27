import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from 'expo-haptics';

export function HapticTab(props: any) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev: any) => {
        Haptics.selectionAsync();
        props.onPressIn?.(ev);
      }}
    />
  );
}
