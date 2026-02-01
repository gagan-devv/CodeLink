import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

/**
 * Orientation type
 */
export type Orientation = 'portrait' | 'landscape';

/**
 * Hook return type
 */
export interface UseOrientationResult {
  orientation: Orientation;
  isPortrait: boolean;
  isLandscape: boolean;
  width: number;
  height: number;
}

/**
 * Custom hook to track device orientation
 * Listens to dimension changes and determines current orientation
 * 
 * Requirements: 10.1, 10.2, 10.3
 * 
 * @returns Current orientation state and dimensions
 */
export const useOrientation = (): UseOrientationResult => {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const handleChange = ({ window }: { window: ScaledSize }) => {
      setDimensions(window);
    };

    const subscription = Dimensions.addEventListener('change', handleChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  const { width, height } = dimensions;
  const orientation: Orientation = width > height ? 'landscape' : 'portrait';

  return {
    orientation,
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape',
    width,
    height,
  };
};
