import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTerminalStore } from './useTerminalStore';
import { SpecialKeysBar } from './SpecialKeysBar';
import { MultilinePasteModal } from './MultilinePasteModal';

export interface TerminalViewProps {
  sessionId: string;
  onSendInput: (data: string) => void;
  onRequestMode: (mode: 'observe' | 'control') => void;
  isConnected?: boolean;
}

export function TerminalView({
  sessionId,
  onSendInput,
  onRequestMode,
  isConnected = true,
}: TerminalViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [inputText, setInputText] = useState('');

  const mode = useTerminalStore((s) => s.mode);
  const hasGap = useTerminalStore((s) => s.hasGap);
  const rawOutput = useTerminalStore((s) => s.getOutput(sessionId));
  const processKeyInput = useTerminalStore((s) => s.processKeyInput);
  const handlePaste = useTerminalStore((s) => s.handlePaste);

  // Auto-scroll on new output
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [rawOutput]);

  const handleInputChange = (text: string) => {
    if (mode !== 'control') return;

    // Check if pasted
    if (text.length > 2 && (text.includes('\n') || text.includes('\r'))) {
      const pasteResult = handlePaste(text);
      if (pasteResult.requiresConfirmation) {
        setInputText('');
        return;
      }
    }

    // Process regular single-character or typed chunk
    if (text.length > inputText.length) {
      const newChars = text.slice(inputText.length);
      for (const char of newChars) {
        const transformed = processKeyInput(char);
        onSendInput(transformed);
      }
    } else if (text.length < inputText.length) {
      // Backspace
      onSendInput('\x7f');
    }
    setInputText(text);
  };

  const handleInputSubmit = () => {
    if (mode !== 'control') return;
    onSendInput('\r');
    setInputText('');
  };

  const cleanAnsi = (text: string): string => {
    // Strip common ANSI escape sequences for text rendering
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\([a-zA-Z]/g, '');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.badgeContainer}>
          <View
            style={[styles.badgeDot, mode === 'control' ? styles.dotControl : styles.dotObserve]}
          />
          <Text style={styles.badgeText}>
            {mode === 'control' ? 'CONTROL MODE' : 'OBSERVE MODE'}
          </Text>
        </View>

        {!isConnected && (
          <View style={styles.reconnectingBadge}>
            <Text style={styles.reconnectingText}>Reconnecting...</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.modeToggleBtn, mode === 'control' && styles.modeToggleBtnActive]}
          onPress={() => onRequestMode(mode === 'control' ? 'observe' : 'control')}
          activeOpacity={0.7}
        >
          <Text style={styles.modeToggleText}>
            {mode === 'control' ? 'Switch to Observe' : 'Request Control'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Gap Warning Banner */}
      {hasGap && (
        <View style={styles.gapBanner}>
          <Text style={styles.gapText}>
            ⚠ Output buffer gap detected. Some lines were skipped due to high throughput.
          </Text>
        </View>
      )}

      {/* Terminal Output Area */}
      <ScrollView
        ref={scrollRef}
        style={styles.outputScroll}
        contentContainerStyle={styles.outputContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <Text style={styles.outputText} selectable>
          {cleanAnsi(rawOutput) || 'Terminal session ready.\n'}
        </Text>
      </ScrollView>

      {/* Input or Observe Notice */}
      {mode === 'control' ? (
        <View style={styles.inputRow}>
          <Text style={styles.promptSymbol}>❯</Text>
          <TextInput
            ref={inputRef}
            style={styles.inputField}
            value={inputText}
            onChangeText={handleInputChange}
            onSubmitEditing={handleInputSubmit}
            placeholder="Type command or keystroke..."
            placeholderTextColor="#555555"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>
      ) : (
        <View style={styles.observeNotice}>
          <Text style={styles.observeNoticeText}>
            Observe Mode: input disabled. Click 'Request Control' to interact with this shell.
          </Text>
        </View>
      )}

      {/* Special Keys Bar */}
      <SpecialKeysBar onSendKey={onSendInput} disabled={mode !== 'control'} />

      {/* Multiline Paste Modal */}
      <MultilinePasteModal onConfirm={(text) => onSendInput(text)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161616',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotControl: {
    backgroundColor: '#107c41',
  },
  dotObserve: {
    backgroundColor: '#cca700',
  },
  badgeText: {
    color: '#cccccc',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reconnectingBadge: {
    backgroundColor: '#795e26',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reconnectingText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  modeToggleBtn: {
    backgroundColor: '#252526',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  modeToggleBtnActive: {
    backgroundColor: '#1f2430',
    borderColor: '#0078d4',
  },
  modeToggleText: {
    color: '#e0e0e0',
    fontSize: 11,
    fontWeight: '600',
  },
  gapBanner: {
    backgroundColor: '#4d2d00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#7a4600',
  },
  gapText: {
    color: '#ffc83b',
    fontSize: 11,
  },
  outputScroll: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  outputContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  outputText: {
    color: '#cccccc',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: '#282828',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  promptSymbol: {
    color: '#0078d4',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 6,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  inputField: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    height: 36,
    paddingVertical: 0,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  observeNotice: {
    backgroundColor: '#181818',
    borderTopWidth: 1,
    borderTopColor: '#282828',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  observeNoticeText: {
    color: '#888888',
    fontSize: 12,
    fontStyle: 'italic',
  },
});
