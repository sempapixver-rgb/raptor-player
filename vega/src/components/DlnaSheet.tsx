import React, {useCallback, useEffect, useState} from 'react';
import {FlatList, StyleSheet, Text, TextInput, View} from 'react-native';
import {
  addDevice,
  cast,
  loadDevices,
  saveDevices,
  stop,
  type DlnaDevice,
} from '../core/dlna';
import type {Entry, SourceConfig} from '../types';
import {colors, radius, space} from '../theme';
import {Button} from './ui';

type Props = {
  visible: boolean;
  source: SourceConfig;
  entry: Entry;
  onClose: () => void;
};

export function DlnaSheet({visible, source, entry, onClose}: Props) {
  const [devices, setDevices] = useState<DlnaDevice[]>([]);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }
    let alive = true;
    loadDevices()
      .then(list => {
        if (alive) {
          setDevices(list);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [visible]);

  const add = useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      const device = await addDevice(address);
      const next = [device, ...devices.filter(item => item.controlUrl !== device.controlUrl)];
      await saveDevices(next);
      setDevices(next);
      setAddress('');
      setMessage('TV adicionada: ' + device.name);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel adicionar a TV.');
    } finally {
      setBusy(false);
    }
  }, [address, devices]);

  const send = useCallback(
    async (device: DlnaDevice) => {
      setBusy(true);
      setMessage('Enviando para ' + device.name + '...');
      try {
        await cast(device, source, entry);
        setMessage('Video enviado para ' + device.name + '.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'A TV nao aceitou o video.');
      } finally {
        setBusy(false);
      }
    },
    [entry, source],
  );

  const halt = useCallback(
    async (device: DlnaDevice) => {
      setBusy(true);
      try {
        await stop(device);
        setMessage('Reproducao parada na TV.');
      } catch {
        setMessage('Nao foi possivel parar a TV.');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.sheet}>
      <View style={styles.head}>
        <Text style={styles.title}>📺 TV</Text>
        <Button label="Fechar" onPress={onClose} />
      </View>
      <Text style={styles.hint}>
        Informe o endereco da TV na rede (ex.: 192.168.1.20) para enviar este video.
      </Text>
      <View style={styles.addRow}>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Endereco da TV"
          placeholderTextColor={colors.textDim}
          autoCorrect={false}
          style={styles.input}
        />
        <Button kind="primary" label="Adicionar" onPress={add} />
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <FlatList
        data={devices}
        style={styles.list}
        keyExtractor={item => item.controlUrl}
        ListEmptyComponent={
          <Text style={styles.hint}>Nenhuma TV salva neste aparelho.</Text>
        }
        renderItem={({item}) => (
          <View style={styles.device}>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.deviceUrl} numberOfLines={1}>
                {item.controlUrl}
              </Text>
            </View>
            <Button label="Enviar" onPress={() => send(item)} />
            <Button label="Parar" onPress={() => halt(item)} />
          </View>
        )}
      />
      {busy ? <Text style={styles.hint}>Aguarde...</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    top: 64,
    right: space.lg,
    bottom: 140,
    width: 640,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: 'rgba(7,11,18,0.96)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  hint: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: space.sm,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: space.md,
    fontSize: 14,
    marginRight: space.sm,
  },
  message: {
    color: colors.accent,
    fontSize: 12,
    marginTop: space.sm,
  },
  list: {
    flex: 1,
    marginTop: space.md,
  },
  device: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  deviceInfo: {
    flex: 1,
    paddingRight: space.md,
  },
  deviceName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  deviceUrl: {
    color: colors.textDim,
    fontSize: 11,
  },
});
