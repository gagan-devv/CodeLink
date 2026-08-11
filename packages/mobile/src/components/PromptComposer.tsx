import React, { useState, useEffect } from 'react';
import {
  TextInput,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { InjectPromptPayload } from '@codelink/protocol';
import { wsManager } from '../ws/WsManager';
import { usePromptStore } from '../store/usePromptStore';
import { useDiffStore } from '../store/useDiffStore';

export function PromptComposer() {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [source, setSource] = useState<'text' | 'voice'>('text');

  const addPrompt = usePromptStore((s) => s.addPrompt);
  const selectedRange = useDiffStore((s) => s.selectedRange);
  const file = useDiffStore((s) => s.file);
  const clearSelection = useDiffStore((s) => s.clearSelection);

  // Voice dictation simulation
  useEffect(() => {
    if (!isDictating) return;

    const phrases = ['Refactor this function', ' to handle errors', ' and optimize performance.'];
    let index = 0;

    const interval = setInterval(() => {
      if (index < phrases.length) {
        const nextChunk = phrases[index];
        setText((prev) => prev + nextChunk);
        index++;
      } else {
        setIsDictating(false);
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isDictating]);

  const toggleDictation = () => {
    if (isDictating) {
      setIsDictating(false);
    } else {
      setIsDictating(true);
      setSource('voice');
    }
  };

  const handleTextChange = (val: string) => {
    setText(val);
    if (!isDictating && source === 'voice' && val.length === 0) {
      setSource('text');
    }
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !wsManager.isConnected()) {
      return;
    }

    setSending(true);
    const id = Math.random().toString(36).slice(2);

    const payload: InjectPromptPayload = {
      prompt: trimmed,
      source: isDictating || source === 'voice' ? 'voice' : 'text',
    };

    if (file && selectedRange) {
      const lines = file.content.split('\n');
      const selectedLines = lines.slice(selectedRange.startLine - 1, selectedRange.endLine);
      payload.targetFile = file.fileName;
      payload.lineRange = {
        startLine: selectedRange.startLine,
        endLine: selectedRange.endLine,
      };
      payload.selectedCode = selectedLines.join('\n');
    }

    wsManager.send('INJECT_PROMPT', payload);
    addPrompt(id, trimmed);

    if (isDictating) {
      setIsDictating(false);
    }
    setText('');
    setSource('text');
    clearSelection();
    setSending(false);
  };

  const canSend = text.trim().length > 0 && !sending && wsManager.isConnected();

  const lineRangeTag =
    selectedRange && file
      ? selectedRange.startLine === selectedRange.endLine
        ? `L${selectedRange.startLine}`
        : `L${selectedRange.startLine}-L${selectedRange.endLine}`
      : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      {file && selectedRange && lineRangeTag && (
        <View style={s.chipContainer}>
          <Text style={s.chipText}>
            [{file.fileName}: {lineRangeTag}]
          </Text>
          <TouchableOpacity onPress={clearSelection} style={s.chipClose}>
            <Text style={s.chipCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        style={s.input}
        placeholder="Type a prompt for the AI editor…"
        placeholderTextColor="#555"
        value={text}
        onChangeText={handleTextChange}
        multiline
        maxLength={2000}
        returnKeyType="default"
      />

      <View style={s.actionsRow}>
        <TouchableOpacity
          style={[s.voiceBtn, isDictating && s.voiceBtnActive]}
          onPress={toggleDictation}
          activeOpacity={0.7}
        >
          <Text style={[s.voiceBtnText, isDictating && s.voiceBtnTextActive]}>
            {isDictating ? '🔴 Dictating…' : '🎙️ Voice'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btn, !canSend && s.btnDisabled]}
          onPress={send}
          disabled={!canSend}
        >
          <Text style={s.btnText}>{sending ? 'Sending…' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, gap: 12 },
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#2c3a4a',
    borderColor: '#3d4f66',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  chipText: {
    color: '#61afef',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  chipClose: {
    padding: 2,
  },
  chipCloseText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#d4d4d4',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    minHeight: 110,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#383838',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  voiceBtn: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#383838',
  },
  voiceBtnActive: {
    backgroundColor: '#8b0000',
    borderColor: '#d9381e',
  },
  voiceBtnText: {
    color: '#d4d4d4',
    fontWeight: '600',
    fontSize: 14,
  },
  voiceBtnTextActive: {
    color: '#ffffff',
  },
  btn: {
    flex: 1,
    backgroundColor: '#0078d4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
