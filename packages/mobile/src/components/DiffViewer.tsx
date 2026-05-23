import React, { useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

interface Props {
  fileName: string;
  content: string;
  isDirty: boolean;
  cursorLine: number;
}

export function DiffViewer({ fileName, content, isDirty, cursorLine }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const lines = content.split('\n');
  const LINE_H = 20;

  // Scroll to cursor when it changes
  React.useEffect(() => {
    const offset = Math.max(0, cursorLine - 8) * LINE_H;
    scrollRef.current?.scrollTo({ y: offset, animated: true });
  }, [cursorLine]);

  return (
    <View style={s.root}>
      {/* Header bar */}
      <View style={s.header}>
        <Text style={s.fileName} numberOfLines={1}>
          {fileName}
        </Text>
        {isDirty && <View style={s.dirtyDot} />}
      </View>

      {/* Code view */}
      <ScrollView ref={scrollRef} style={s.scroll} horizontal={false} showsVerticalScrollIndicator>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {lines.map((line, i) => (
              <View key={i} style={[s.row, i === cursorLine && s.activeLine]}>
                <Text style={s.gutter}>{i + 1}</Text>
                <Text style={s.code}>{line || ' '}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1e1e1e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#252526',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  fileName: { color: '#ccc', fontSize: 13, fontFamily: 'monospace', flex: 1 },
  dirtyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e5c07b', marginLeft: 8 },
  scroll: { flex: 1 },
  row: { flexDirection: 'row', height: 20, alignItems: 'center', paddingRight: 16 },
  activeLine: { backgroundColor: '#2c3a4a' },
  gutter: {
    width: 44,
    textAlign: 'right',
    paddingRight: 12,
    color: '#5a5a5a',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  code: { color: '#d4d4d4', fontSize: 12, fontFamily: 'monospace' },
});
