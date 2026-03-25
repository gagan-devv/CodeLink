/**
 * Draft prompt management hook
 * Auto-saves and restores draft prompts
 */

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_STORAGE_KEY = '@codelink/draft-prompt';
const AUTO_SAVE_DELAY = 1000; // 1 second

export const useDraftPrompt = () => {
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load draft on mount
  useEffect(() => {
    loadDraft();
  }, []);

  // Auto-save draft with debounce
  useEffect(() => {
    if (draft === '') return;

    const timer = setTimeout(() => {
      saveDraft(draft);
    }, AUTO_SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [draft]);

  const loadDraft = async () => {
    try {
      const stored = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        setDraft(stored);
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
  };

  const saveDraft = async (text: string) => {
    try {
      setIsSaving(true);
      await AsyncStorage.setItem(DRAFT_STORAGE_KEY, text);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
      setDraft('');
      setLastSaved(null);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  };

  return {
    draft,
    setDraft,
    clearDraft,
    isSaving,
    lastSaved,
  };
};
