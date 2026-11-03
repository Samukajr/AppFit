import assert from 'node:assert/strict';
import { test } from 'node:test';
import { palettes } from '../src/theme/palette.ts';
import { createThemePreference, themePreferenceKey } from '../src/theme/preference.ts';

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('ambos os temas evitam verdes e mantem contraste de texto de pelo menos 4.5:1', () => {
  for (const [mode, colors] of Object.entries(palettes)) {
    for (const [token, hex] of Object.entries(colors)) {
      assert.match(hex, /^#[0-9A-F]{6}$/i);
      const [r, g, b] = hex.slice(1).match(/../g).map((part) => parseInt(part, 16));
      assert.ok(!(g > r && g > b), `${mode}.${token} nao deve ter verde dominante`);
    }
    for (const background of ['background', 'surface', 'elevated', 'hero', 'primarySoft']) {
      for (const foreground of ['text', 'muted', 'primary', 'secondary', 'danger']) {
        const ratio = contrast(colors[foreground], colors[background]);
        assert.ok(ratio >= 4.5, `${mode}.${foreground}/${background}: ${ratio.toFixed(2)}:1`);
      }
    }
    assert.ok(contrast(colors.onPrimary, colors.primary) >= 4.5, `${mode} botao principal`);
  }
});

test('preferencia inicia clara, persiste nos dois sentidos e sobrevive a nova instancia', async () => {
  const data = new Map();
  const storage = {
    async getItem(key) { return data.get(key) ?? null; },
    async setItem(key, value) { data.set(key, value); },
  };
  const preference = createThemePreference(storage);
  assert.equal(await preference.load(), 'light');
  await preference.save('dark');
  assert.equal(data.get(themePreferenceKey), 'dark');
  assert.equal(await createThemePreference(storage).load(), 'dark');
  await preference.save('light');
  assert.equal(await createThemePreference(storage).load(), 'light');
});

test('preferencia invalida e armazenamento indisponivel produzem erros explicitos', async () => {
  const invalid = createThemePreference({
    async getItem() { return 'green'; },
    async setItem() { throw new Error('storage blocked'); },
  });
  await assert.rejects(invalid.load(), /inválida/);
  await assert.rejects(invalid.save('dark'), /storage blocked/);
  await assert.rejects(invalid.save('green'), /inválido/);
  const unavailable = createThemePreference({
    async getItem() { throw new Error('storage denied'); },
    async setItem() { throw new Error('storage denied'); },
  });
  await assert.rejects(unavailable.load(), /storage denied/);
});
