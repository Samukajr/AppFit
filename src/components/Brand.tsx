import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type ThemeColors } from '../theme';

export function Brand() {
  const { colors, styles } = useThemedStyles(createStyles);
  return <View style={styles.row}>
    <View style={styles.mark}><Feather name="activity" size={24} color={colors.onPrimary} /></View>
    <View>
      <Text style={styles.name}>MAROMBA<Text style={styles.accent}>FIT</Text></Text>
      <Text style={styles.caption}>MOVIMENTO. DADOS. EVOLUÇÃO.</Text>
    </View>
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: 1.5 },
  accent: { color: colors.primary },
  caption: { color: colors.muted, fontSize: 8, letterSpacing: 1.7, marginTop: 5, fontWeight: '600' },
});
