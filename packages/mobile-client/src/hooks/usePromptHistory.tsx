/**
 * Prompt history management hook
 * Stores and retrieves prompt history with AsyncStorage
 */

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_STORAGE_KEY = '@codelink/prompt-history';
const MAX_HISTORY_ITEMS = 50;

export interface PromptHistoryItem {
  id: string;
  prompt: string;
  timestamp: number;
  success?: boolean;
  editorUsed?: string;
}

export const usePromptHistory = () => {
  const [history, setHistory] = useState<PromptHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load prompt history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveHistory = async (newHistory: PromptHistoryItem[]) => {
    try {
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (error) {
      console.error('Failed to save prompt history:', error);
    }
  };

  const addToHistory = async (item: PromptHistoryItem) => {
    const newHistory = [item, ...history].slice(0, MAX_HISTORY_ITEMS);
    await saveHistory(newHistory);
  };

  const updateHistoryItem = async (id: string, updates: Partial<PromptHistoryItem>) => {
    const newHistory = history.map((item) => (item.id === id ? { ...item, ...updates } : item));
    await saveHistory(newHistory);
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
      setHistory([]);
    } catch (error) {
      console.error('Failed to clear prompt history:', error);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    const newHistory = history.filter((item) => item.id !== id);
    await saveHistory(newHistory);
  };

  return {
    history,
    isLoading,
    addToHistory,
    updateHistoryItem,
    clearHistory,
    deleteHistoryItem,
  };
};
