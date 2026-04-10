/**
 * Screen Reader Announcement Hook
 *
 * Provides utilities for announcing messages to screen readers (VoiceOver/TalkBack).
 * Used for accessibility to announce screen changes, toast notifications, and loading states.
 *
 * Requirements: 14.3, 14.11
 */

import { useEffect, useCallback } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Hook for announcing messages to screen readers
 *
 * @returns announce function to trigger screen reader announcements
 */
export const useScreenReaderAnnouncement = () => {
  /**
   * Announce a message to screen readers
   *
   * @param message - The message to announce
   * @param delay - Optional delay in milliseconds before announcing (default: 100ms)
   */
  const announce = useCallback((message: string, delay: number = 100) => {
    // Small delay to ensure the screen reader is ready
    setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(message);
    }, delay);
  }, []);

  return { announce };
};

/**
 * Hook for announcing screen changes on navigation
 *
 * @param screenName - The name of the current screen
 */
export const useScreenChangeAnnouncement = (screenName: string) => {
  const { announce } = useScreenReaderAnnouncement();

  useEffect(() => {
    // Announce screen change with a slight delay to ensure navigation is complete
    announce(`${screenName} screen`, 300);
  }, [screenName, announce]);
};

/**
 * Hook for announcing loading states
 *
 * @param isLoading - Whether the loading state is active
 * @param loadingMessage - The message to announce when loading starts
 * @param completeMessage - Optional message to announce when loading completes
 */
export const useLoadingAnnouncement = (
  isLoading: boolean,
  loadingMessage: string = 'Loading',
  completeMessage?: string
) => {
  const { announce } = useScreenReaderAnnouncement();

  useEffect(() => {
    if (isLoading) {
      announce(loadingMessage);
    } else if (completeMessage) {
      announce(completeMessage);
    }
  }, [isLoading, loadingMessage, completeMessage, announce]);
};
