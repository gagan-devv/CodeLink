/**
 * Font Loading Utility
 *
 * This module provides font loading functionality with error handling
 * and fallback to system fonts.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

/**
 * Font loading result
 */
export interface FontLoadingResult {
  fontsLoaded: boolean;
  fontError: Error | null;
}

/**
 * Custom hook for loading all required fonts
 *
 * Loads Manrope (weights 400, 600, 700, 800), Inter (weights 400, 500, 600),
 * and Space Grotesk (weights 400, 500, 700) fonts.
 *
 * @returns Object containing fontsLoaded boolean and fontError
 *
 * @example
 * ```tsx
 * const { fontsLoaded, fontError } = useCustomFonts();
 *
 * if (fontError) {
 *   console.error('Font loading failed:', fontError);
 *   // App will continue with system fonts
 * }
 *
 * if (!fontsLoaded) {
 *   return <AppLoading />;
 * }
 * ```
 */
export function useCustomFonts(): FontLoadingResult {
  const [fontsLoaded, fontError] = useFonts({
    // Manrope fonts (for headlines)
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,

    // Inter fonts (for body text)
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,

    // Space Grotesk fonts (for labels)
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  // Log error if font loading fails
  if (fontError) {
    console.error('Font loading failed:', fontError);
    console.warn('Falling back to system fonts');
  }

  return {
    fontsLoaded,
    fontError,
  };
}

/**
 * Get font family name based on variant and weight
 *
 * Returns the appropriate font family string for React Native StyleSheet.
 * Falls back to system fonts if custom fonts are not loaded.
 *
 * @param variant - Font variant: 'headline', 'body', 'label', or 'mono'
 * @param weight - Font weight: 400, 500, 600, 700, or 800
 * @param fontsLoaded - Whether custom fonts are loaded
 * @returns Font family string
 */
export function getFontFamily(
  variant: 'headline' | 'body' | 'label' | 'mono',
  weight: 400 | 500 | 600 | 700 | 800,
  fontsLoaded: boolean
): string {
  // Fallback to system fonts if custom fonts not loaded
  if (!fontsLoaded) {
    if (variant === 'mono') {
      return 'monospace';
    }
    return 'System';
  }

  // Return appropriate font family based on variant and weight
  switch (variant) {
    case 'headline':
      switch (weight) {
        case 400:
          return 'Manrope_400Regular';
        case 600:
          return 'Manrope_600SemiBold';
        case 700:
          return 'Manrope_700Bold';
        case 800:
          return 'Manrope_800ExtraBold';
        default:
          return 'Manrope_400Regular';
      }

    case 'body':
      switch (weight) {
        case 400:
          return 'Inter_400Regular';
        case 500:
          return 'Inter_500Medium';
        case 600:
          return 'Inter_600SemiBold';
        default:
          return 'Inter_400Regular';
      }

    case 'label':
      switch (weight) {
        case 400:
          return 'SpaceGrotesk_400Regular';
        case 500:
          return 'SpaceGrotesk_500Medium';
        case 700:
          return 'SpaceGrotesk_700Bold';
        default:
          return 'SpaceGrotesk_400Regular';
      }

    case 'mono':
      return 'monospace';

    default:
      return 'System';
  }
}
