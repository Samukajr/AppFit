import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router/react-navigation';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { ThemeProvider, useThemedStyles, type ThemeColors } from '../theme';

function Routes() {
  const { colors, styles, mode, loading: themeLoading } = useThemedStyles(createStyles);
  const { loading, session } = useAuth();
  const navigationTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: colors.background, card: colors.surface, text: colors.text,
      border: colors.border, primary: colors.primary, notification: colors.danger,
    },
  };
  return (
    <NavigationThemeProvider value={navigationTheme}>
    <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    {loading || themeLoading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} accessibilityLabel="Carregando sessão e aparência" /></View> :
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!session}><Stack.Screen name="login" /></Stack.Protected>
      <Stack.Protected guard={!!session}><Stack.Screen name="index" /></Stack.Protected>
      <Stack.Screen name="auth/callback" />
    </Stack>}
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return <SafeAreaProvider><ThemeProvider><AuthProvider><Routes /></AuthProvider></ThemeProvider></SafeAreaProvider>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({ loading: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' } });
