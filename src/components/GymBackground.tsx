import { useState, type PropsWithChildren } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type ThemeColors } from '../theme';

export function GymBackground({ children }: PropsWithChildren) {
  const { styles, mode } = useThemedStyles(createStyles);
  const [imageError, setImageError] = useState(false);

  return <View style={styles.container}>
    <View pointerEvents="none" style={styles.backdrop}>
      <Image source={require('../../Fundo.jpg')} resizeMode="cover"
        accessible={false} accessibilityIgnoresInvertColors
        style={styles.image} onError={() => setImageError(true)} />
      <View style={[styles.tint, { opacity: mode === 'dark' ? 0.72 : 0.8 }]} />
    </View>
    {imageError && <Text accessibilityRole="alert" style={styles.error}>Não foi possível carregar a foto da academia.</Text>}
    {children}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  image: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  tint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.background },
  error: { padding: 16, color: colors.danger, backgroundColor: colors.surface },
});
