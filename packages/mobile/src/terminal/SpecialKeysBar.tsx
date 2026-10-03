import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useTerminalStore, SpecialKey } from './useTerminalStore';

export interface SpecialKeysBarProps {
  onSendKey: (data: string) => void;
  disabled?: boolean;
}

export function SpecialKeysBar({ onSendKey, disabled = false }: SpecialKeysBarProps) {
  const isCtrlActive = useTerminalStore((s) => s.isCtrlActive);
  const isAltActive = useTerminalStore((s) => s.isAltActive);
  const toggleCtrl = useTerminalStore((s) => s.toggleCtrl);
  const toggleAlt = useTerminalStore((s) => s.toggleAlt);
  const formatSpecialKey = useTerminalStore((s) => s.formatSpecialKey);

  const handleKey = (key: SpecialKey) => {
    if (disabled) return;
    const seq = formatSpecialKey(key);
    if (seq) {
      onSendKey(seq);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <TouchableOpacity
          style={[styles.btn, isCtrlActive && styles.btnActive, disabled && styles.btnDisabled]}
          onPress={() => !disabled && toggleCtrl()}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnText, isCtrlActive && styles.btnTextActive]}>Ctrl</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, isAltActive && styles.btnActive, disabled && styles.btnDisabled]}
          onPress={() => !disabled && toggleAlt()}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnText, isAltActive && styles.btnTextActive]}>Alt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={() => handleKey('ESC')}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>Esc</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={() => handleKey('TAB')}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>Tab</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={() => handleKey('CTRL_C')}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>^C</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={() => handleKey('CTRL_D')}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>^D</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={() => handleKey('UP')}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>↑</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={() => handleKey('DOWN')}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>↓</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={() => handleKey('LEFT')}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={() => handleKey('RIGHT')}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={() => handleKey('PGUP')}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>PgUp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={() => handleKey('PGDN')}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>PgDn</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#181818',
    borderTopWidth: 1,
    borderTopColor: '#2d2d2d',
    paddingVertical: 6,
  },
  scroll: {
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  btn: {
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  btnActive: {
    backgroundColor: '#0078d4',
    borderColor: '#2b88d8',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    color: '#e0e0e0',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  btnTextActive: {
    color: '#ffffff',
  },
});
