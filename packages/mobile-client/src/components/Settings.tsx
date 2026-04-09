/**
 * Settings screen component
 * Provides app configuration options
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { List, Button, Divider, RadioButton } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../hooks/useTheme';
import { usePromptHistory } from '../hooks/usePromptHistory';
import { ThemeMode } from '../theme';

export const Settings: React.FC = () => {
  const { themeMode, setThemeMode } = useTheme();
  const { clearHistory } = usePromptHistory();
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');

  const handleClearCache = async () => {
    Alert.alert('Clear Cache', 'Are you sure you want to clear all cached data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.clear();
            Alert.alert('Success', 'Cache cleared successfully');
          } catch (error) {
            Alert.alert('Error', 'Failed to clear cache');
          }
        },
      },
    ]);
  };

  const handleClearHistory = () => {
    Alert.alert('Clear History', 'Are you sure you want to clear all prompt history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          Alert.alert('Success', 'History cleared successfully');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Appearance Section */}
      <List.Section>
        <List.Subheader>Appearance</List.Subheader>

        <List.Item
          title="Theme"
          description="Choose your preferred theme"
          left={(_props) => <List.Icon {..._props} icon="palette" />}
        />
        <RadioButton.Group
          onValueChange={(value) => setThemeMode(value as ThemeMode)}
          value={themeMode}
        >
          <View style={styles.radioGroup}>
            <RadioButton.Item label="Light" value="light" />
            <RadioButton.Item label="Dark" value="dark" />
            <RadioButton.Item label="Auto (System)" value="auto" />
          </View>
        </RadioButton.Group>

        <Divider />

        <List.Item
          title="Font Size"
          description="Adjust text size"
          left={(_props) => <List.Icon {..._props} icon="format-size" />}
        />
        <RadioButton.Group
          onValueChange={(value) => setFontSize(value as 'small' | 'medium' | 'large')}
          value={fontSize}
        >
          <View style={styles.radioGroup}>
            <RadioButton.Item label="Small" value="small" />
            <RadioButton.Item label="Medium" value="medium" />
            <RadioButton.Item label="Large" value="large" />
          </View>
        </RadioButton.Group>
      </List.Section>

      <Divider />

      {/* Data & Privacy Section */}
      <List.Section>
        <List.Subheader>Data & Privacy</List.Subheader>

        <List.Item
          title="Clear Prompt History"
          description="Remove all saved prompts"
          left={(_props) => <List.Icon {..._props} icon="history" />}
          right={(_props) => (
            <Button mode="outlined" onPress={handleClearHistory}>
              Clear
            </Button>
          )}
        />

        <List.Item
          title="Clear Cache"
          description="Remove all cached data"
          left={(_props) => <List.Icon {..._props} icon="delete-sweep" />}
          right={(_props) => (
            <Button mode="outlined" onPress={handleClearCache}>
              Clear
            </Button>
          )}
        />
      </List.Section>

      <Divider />

      {/* About Section */}
      <List.Section>
        <List.Subheader>About</List.Subheader>

        <List.Item
          title="Version"
          description="0.1.0"
          left={(_props) => <List.Icon {..._props} icon="information" />}
        />

        <List.Item
          title="CodeLink Mobile Client"
          description="AI-powered code collaboration"
          left={(_props) => <List.Icon {..._props} icon="code-braces" />}
        />
      </List.Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Made with ❤️ for developers</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  radioGroup: {
    paddingLeft: 16,
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
  },
});
