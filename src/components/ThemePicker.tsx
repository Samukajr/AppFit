import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type ThemeColors } from '../theme';

export function ThemePicker() {
  const { mode, styles, colors, loading, saving, error, setMode } = useThemedStyles(createStyles);
  return <View style={styles.container}>
    <View style={styles.row}>
      <Text style={styles.label}>Aparência</Text>
      <View style={styles.options}>
        {(['light', 'dark'] as const).map((value) => <Pressable key={value} accessibilityRole="button"
          accessibilityLabel={`Usar tema ${value === 'light' ? 'claro' : 'escuro'}`}
          accessibilityState={{ selected: mode === value, disabled: loading || saving }}
          disabled={loading || saving} onPress={() => void setMode(value)}
          style={[styles.option, mode === value && styles.selected]}>
          <Feather name={value === 'light' ? 'sun' : 'moon'} size={16} color={mode === value ? colors.primary : colors.muted} />
          <Text style={[styles.text, mode === value && styles.selectedText]}>{value === 'light' ? 'Claro' : 'Escuro'}</Text>
        </Pressable>)}
      </View>
    </View>
    {saving && <Text accessibilityLiveRegion="polite" style={styles.text}>Salvando preferência…</Text>}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  options: { flexDirection: 'row', gap: 8 },
  option: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 14, minHeight: 44, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  text: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  selectedText: { color: colors.primary, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 12, lineHeight: 20 },
});
