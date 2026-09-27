import React from 'react';
import type { WidgetSnapshot } from './data-service';

// Use dynamic require to avoid crashes when the native module is not available.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { FlexWidget, TextWidget } = require('react-native-android-widget');

// Ignis dark theme — widgets always render dark for high-contrast glanceability.
const BG = '#151614';
const TEXT = '#F1EFE7';
const MUTED = '#B9B7AF';
const ACCENT = '#FF5148';

export function NextDutyWidget({ data }: { data: WidgetSnapshot | null }) {
  if (!data || !data.nextDuty) {
    return (
      <FlexWidget
        style={{
          backgroundColor: BG,
          borderRadius: 16,
          padding: 12,
          height: 'match_parent',
          width: 'match_parent',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget
          text="Schedule clear"
          style={{ fontSize: 14, color: MUTED }}
        />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      style={{
        backgroundColor: BG,
        borderRadius: 16,
        padding: 12,
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
      clickAction="OPEN_APP"
    >
      {/* Left: Next duty time + date */}
      <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
        <TextWidget
          text={data.nextDuty.time}
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: TEXT,
          }}
        />
        <TextWidget
          text={data.nextDuty.date}
          style={{ fontSize: 12, color: MUTED }}
        />
        {data.nextDuty.note ? (
          <TextWidget
            text={data.nextDuty.note}
            style={{ fontSize: 11, color: MUTED }}
            maxLines={1}
          />
        ) : null}
      </FlexWidget>

      {/* Right: Pay totals */}
      <FlexWidget
        style={{
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        <TextWidget
          text={data.periodTotals.earned}
          style={{ fontSize: 13, color: ACCENT }}
        />
        <TextWidget
          text={data.periodTotals.projected}
          style={{ fontSize: 11, color: MUTED }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
