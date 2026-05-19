import { View, Text, FlatList, StyleSheet } from 'react-native';
import { usePromptStore, PromptEntry } from '../../src/store/usePromptStore';
import { useSessionStore }             from '../../src/store/useSessionStore';
import { PromptComposer }              from '../../src/components/PromptComposer';

function HistoryItem({ item }: { item: PromptEntry }) {
  const color = item.status === 'success' ? '#4ec94e'
              : item.status === 'error'   ? '#f55'
              : '#888';
  return (
    <View style={h.row}>
      <View style={[h.dot, { backgroundColor: color }]} />
      <View style={h.content}>
        <Text style={h.text} numberOfLines={2}>{item.text}</Text>
        {item.editorUsed && <Text style={h.meta}>via {item.editorUsed}</Text>}
        {item.error      && <Text style={h.err}>{item.error}</Text>}
      </View>
    </View>
  );
}

export default function PromptTab() {
  const prompts = usePromptStore(s => s.prompts);
  const status  = useSessionStore(s => s.status);

  return (
    <View style={s.root}>
      {status !== 'connected' && (
        <View style={s.banner}>
          <Text style={s.bannerText}>Not connected — prompts won't be sent</Text>
        </View>
      )}
      <FlatList
        data={[...prompts].reverse()}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <HistoryItem item={item} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>No prompts sent yet</Text>
          </View>
        }
        contentContainerStyle={{ flexGrow: 1 }}
        style={s.list}
      />
      <PromptComposer />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#1e1e1e' },
  banner:     { backgroundColor: '#3a2a00', padding: 10, alignItems: 'center' },
  bannerText: { color: '#e5c07b', fontSize: 13 },
  list:       { flex: 1 },
  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText:  { color: '#555', fontSize: 14 },
});

const h = StyleSheet.create({
  row:     { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  dot:     { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 10 },
  content: { flex: 1 },
  text:    { color: '#ccc', fontSize: 14 },
  meta:    { color: '#555', fontSize: 12, marginTop: 4 },
  err:     { color: '#f55', fontSize: 12, marginTop: 4 },
});