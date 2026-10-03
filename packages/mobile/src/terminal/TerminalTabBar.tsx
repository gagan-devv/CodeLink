import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTerminalStore } from './useTerminalStore';

export interface TerminalTabBarProps {
  onCreateSession: () => void;
  onCloseSession: (sessionId: string) => void;
  disabled?: boolean;
}

export function TerminalTabBar({
  onCreateSession,
  onCloseSession,
  disabled = false,
}: TerminalTabBarProps) {
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {sessions.map((sess) => {
          const isActive = sess.id === activeSessionId;
          return (
            <TouchableOpacity
              key={sess.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveSession(sess.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabTitle, isActive && styles.tabTitleActive]} numberOfLines={1}>
                {sess.title || sess.id}
              </Text>
              {sess.observerCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{sess.observerCount}</Text>
                </View>
              )}
              {isActive && (
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    onCloseSession(sess.id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.closeBtnText}>×</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        {sessions.length < 8 && (
          <TouchableOpacity
            style={[styles.addBtn, disabled && styles.addBtnDisabled]}
            onPress={onCreateSession}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#181818',
    borderBottomWidth: 1,
    borderBottomColor: '#2b2b2b',
    height: 40,
  },
  scroll: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222222',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333333',
    maxWidth: 160,
  },
  tabActive: {
    backgroundColor: '#1e1e1e',
    borderColor: '#0078d4',
    borderBottomColor: '#1e1e1e',
  },
  tabTitle: {
    color: '#999999',
    fontSize: 12,
    fontWeight: '500',
    marginRight: 6,
  },
  tabTitleActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: 6,
  },
  badgeText: {
    color: '#cccccc',
    fontSize: 10,
  },
  closeBtn: {
    marginLeft: 4,
    paddingHorizontal: 2,
  },
  closeBtnText: {
    color: '#888888',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14,
  },
  addBtn: {
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#252526',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    color: '#0078d4',
    fontSize: 12,
    fontWeight: '600',
  },
});
