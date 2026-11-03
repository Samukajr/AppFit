import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createChunkedStorage, type StringStorage } from './chunkedStorage';

const nativeStorage = createChunkedStorage({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
});

export const sessionStorage: StringStorage = Platform.OS === 'web' ? {
  async getItem(key) { return window.sessionStorage.getItem(key); },
  async setItem(key, value) { window.sessionStorage.setItem(key, value); },
  async removeItem(key) { window.sessionStorage.removeItem(key); },
} : nativeStorage;
