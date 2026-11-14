import {AsyncStorage} from '@amazon-devices/react-native-kepler';

const PREFIX = 'reptor.vega.';

const keyOf = (key: string) => PREFIX + key;

export async function readText(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(keyOf(key));
  } catch {
    return null;
  }
}

export async function writeText(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyOf(key), value);
  } catch {
    // Sem armazenamento o app continua funcionando na sessao atual.
  }
}

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await readText(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  await writeText(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyOf(key));
  } catch {
    // ignora
  }
}
