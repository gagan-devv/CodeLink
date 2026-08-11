import React, { useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useDiffStore } from '../store/useDiffStore';

interface Props {
  fileName: string;
  content: string;
  isDirty: boolean;
  cursorLine: number;
}

export function DiffViewer({ fileName, content, isDirty, cursorLine }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedRange = useDiffStore((s) => s.selectedRange);
  const selectLineRange = useDiffStore((s) => s.selectLineRange);
  const clearSelection = useDiffStore((s) => s.clearSelection);

  const lines = content.split('\n');
  const LINE_H = 20;

  // Scroll to cursor when it changes
  React.useEffect(() => {
    const offset = Math.max(0, cursorLine - 8) * LINE_H;
    scrollRef.current?.scrollTo({ y: offset, animated: true });
  }, [cursorLine]);

  const handleLinePress = (lineNum: number) => {
    if (!selectedRange) {
      selectLineRange(lineNum, lineNum);
    } else if (selectedRange.startLine === lineNum && selectedRange.endLine === lineNum) {
      clearSelection();
    } else if (selectedRange.startLine === selectedRange.endLine) {
      selectLineRange(selectedRange.startLine, lineNum);
    } else {
      if (lineNum === selectedRange.startLine || lineNum === selectedRange.endLine) {
        clearSelection();
      } else {
        selectLineRange(selectedRange.startLine, lineNum);
      }
    }
  };

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
            {lines.map((line, i) => {
              const lineNum = i + 1;
              const isSelected =
                selectedRange !== null &&
                lineNum >= selectedRange.startLine &&
                lineNum <= selectedRange.endLine;

              return (
                <View
                  key={i}
                  style={[
                    s.row,
                    i === cursorLine && s.activeLine,
                    isSelected && s.selectedLine,
                  ]}
                >
                  <TouchableOpacity onPress={() => handleLinePress(lineNum)} activeOpacity={0.7}>
                    <Text style={[s.gutter, isSelected && s.selectedGutter]}>{lineNum}</Text>
                  </TouchableOpacity>
                  <Text style={s.code}>{line || ' '}</Text>
                </View>
              );
            })}
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
  selectedLine: { backgroundColor: '#3d4f66' },
  gutter: {
    width: 44,
    textAlign: 'right',
    paddingRight: 12,
    color: '#5a5a5a',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  selectedGutter: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  code: { color: '#d4d4d4', fontSize: 12, fontFamily: 'monospace' },
});
