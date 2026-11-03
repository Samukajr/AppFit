import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export function getAuthRedirectUrl() {
  if (Platform.OS === 'web') return new URL('/auth/callback', window.location.origin).toString();
  return Linking.createURL('auth/callback', { scheme: 'marombafit' });
}
