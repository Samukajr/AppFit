export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  elevated: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  primaryBorder: string;
  secondary: string;
  danger: string;
  hero: string;
  orbit: string;
  progressTrack: string;
};

export const palettes: Record<ThemeMode, ThemeColors> = {
  light: {
    background: '#F4F7FC',
    surface: '#FFFFFF',
    elevated: '#EDF2FA',
    border: '#C4D0E2',
    text: '#15233B',
    muted: '#52627A',
    primary: '#245DCE',
    onPrimary: '#FFFFFF',
    primarySoft: '#E7EFFF',
    primaryBorder: '#9AB5EF',
    secondary: '#6549AD',
    danger: '#B42338',
    hero: '#EDF3FF',
    orbit: '#DFE9FC',
    progressTrack: '#CDDCF7',
  },
  dark: {
    background: '#0D1422',
    surface: '#151F32',
    elevated: '#1E2B42',
    border: '#35435C',
    text: '#F3F6FC',
    muted: '#AEBCD2',
    primary: '#9CC2FF',
    onPrimary: '#0D1422',
    primarySoft: '#1C3153',
    primaryBorder: '#446493',
    secondary: '#C4B5FD',
    danger: '#FFB4BE',
    hero: '#172840',
    orbit: '#203B62',
    progressTrack: '#324D73',
  },
};
