import React, { useState } from 'react';
import {
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { wsManager } from '../ws/WsManager';
import { usePromptStore } from '../store/usePromptStore';

export function PromptComposer() {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const addPrompt = usePromptStore((s) => s.addPrompt);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !wsManager.isConnected()) {
      return;
    }

    setSending(true);
    const id = Math.random().toString(36).slice(2);
    wsManager.send('INJECT_PROMPT', { prompt: trimmed });
    addPrompt(id, trimmed);
    setText('');
    setSending(false);
  };

  const canSend = text.trim().length > 0 && !sending && wsManager.isConnected();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <TextInput
        style={s.input}
        placeholder="Type a prompt for the AI editor…"
        placeholderTextColor="#555"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={2000}
        returnKeyType="default"
      />
      <TouchableOpacity
        style={[s.btn, !canSend && s.btnDisabled]}
        onPress={send}
        disabled={!canSend}
      >
        <Text style={s.btnText}>{sending ? 'Sending…' : 'Send'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { padding: 16, gap: 12 },
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
  btn: {
    backgroundColor: '#0078d4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
