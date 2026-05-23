import { View, Text, StyleSheet } from 'react-native';
import { useDiffStore } from '../../src/store/useDiffStore';
import { useSessionStore } from '../../src/store/useSessionStore';
import { DiffViewer } from '../../src/components/DiffViewer';

export default function EditorTab() {
  const file = useDiffStore((s) => s.file);
  const status = useSessionStore((s) => s.status);

  if (status !== 'connected') {
    return (
      <View style={s.center}>
        <Text style={s.icon}>⚡</Text>
        <Text style={s.title}>Not connected</Text>
        <Text style={s.body}>Go to Settings → Pair Device to connect to VS Code.</Text>
      </View>
    );
  }

  if (!file) {
    return (
      <View style={s.center}>
        <Text style={s.icon}>📄</Text>
        <Text style={s.title}>No file open</Text>
        <Text style={s.body}>Open a file in VS Code and it will appear here.</Text>
      </View>
    );
  }

  return (
    <DiffViewer
      fileName={file.fileName}
      content={file.content}
      isDirty={file.isDirty}
      cursorLine={file.cursorLine}
    />
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#1e1e1e',
  },
  icon: { fontSize: 40, marginBottom: 16 },
  title: { color: '#ccc', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
