import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useTerminalStore } from './useTerminalStore';

export interface MultilinePasteModalProps {
  onConfirm: (text: string) => void;
}

export function MultilinePasteModal({ onConfirm }: MultilinePasteModalProps) {
  const modal = useTerminalStore((s) => s.multilinePasteModal);
  const confirmPaste = useTerminalStore((s) => s.confirmPaste);
  const cancelPaste = useTerminalStore((s) => s.cancelPaste);

  if (!modal.visible) {
    return null;
  }

  const handleConfirm = () => {
    const text = confirmPaste();
    if (text) {
      onConfirm(text);
    }
  };

  return (
    <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={cancelPaste}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Confirm Multiline Paste</Text>
          <Text style={styles.warning}>
            Warning: Pasting {modal.lineCount} lines will execute commands immediately in the host
            shell with full OS privileges.
          </Text>

          <View style={styles.previewContainer}>
            <ScrollView style={styles.previewScroll}>
              <Text style={styles.previewText}>{modal.text}</Text>
            </ScrollView>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelPaste}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Paste Anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    width: '100%',
    maxWidth: 480,
    padding: 18,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  warning: {
    color: '#f48771',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  previewContainer: {
    backgroundColor: '#121212',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    maxHeight: 160,
    padding: 10,
    marginBottom: 16,
  },
  previewScroll: {
    maxHeight: 140,
  },
  previewText: {
    color: '#d4d4d4',
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    backgroundColor: '#333333',
  },
  cancelBtnText: {
    color: '#e0e0e0',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    backgroundColor: '#d83b01',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
