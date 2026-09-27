import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { readWidgetSnapshot } from './data-service';
import { NextDutyWidget } from './NextDutyWidget';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction } = props;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await readWidgetSnapshot();
      props.renderWidget(<NextDutyWidget data={data} />);
      break;
    }
    case 'WIDGET_DELETED':
    case 'WIDGET_CLICK':
      // WIDGET_CLICK with clickAction="OPEN_APP" is handled by the library
      break;
  }
}
