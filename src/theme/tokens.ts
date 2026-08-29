import { useColorScheme } from 'react-native';

export type IgnisTheme = {
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceRaised: string;
    surfaceStrong: string;
    onSurfaceStrong: string;
    onSurfaceStrongMuted: string;
    instrumentLine: string;
    ink: string;
    inkMuted: string;
    outline: string;
    outlineStrong: string;
    accent: string;
    onAccent: string;
    success: string;
    danger: string;
  };
};

const light: IgnisTheme = {
  dark: false,
  colors: {
    background: '#EAE8E1',
    surface: '#F5F3EC',
    surfaceRaised: '#FEFCF4',
    surfaceStrong: '#20211F',
    onSurfaceStrong: '#F5F3EC',
    onSurfaceStrongMuted: '#D5D3CB',
    instrumentLine: '#8E8E87',
    ink: '#151615',
    inkMuted: '#5B5C57',
    outline: '#B9B7AE',
    outlineStrong: '#5E5F5A',
    accent: '#D92C25',
    onAccent: '#FFFFFF',
    success: '#2E7D4D',
    danger: '#BA1A1A',
  },
};

const dark: IgnisTheme = {
  dark: true,
  colors: {
    background: '#0B0B0A',
    surface: '#151614',
    surfaceRaised: '#1D1E1B',
    surfaceStrong: '#E9E7DF',
    onSurfaceStrong: '#151614',
    onSurfaceStrongMuted: '#454640',
    instrumentLine: '#686963',
    ink: '#F1EFE7',
    inkMuted: '#B9B7AF',
    outline: '#454640',
    outlineStrong: '#9A9991',
    accent: '#FF5148',
    onAccent: '#220503',
    success: '#72D49A',
    danger: '#FFB4AB',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
};

export const displayFont = 'Doto_700Bold';
export const displayFontStrong = 'Doto_800ExtraBold';

export function useIgnisTheme(): IgnisTheme {
  return useColorScheme() === 'dark' ? dark : light;
}
