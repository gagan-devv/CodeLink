// Custom React hooks
// This file will export all custom hooks

export {
  ConnectionStatusProvider,
  useConnection,
  type ConnectionStatus,
  type ConnectionContextValue,
  type ConnectionStatusProviderProps,
} from './useConnection';

export { useOrientation, type Orientation, type UseOrientationResult } from './useOrientation';

export { ThemeProvider, useTheme } from './useTheme';

export { usePromptHistory, type PromptHistoryItem } from './usePromptHistory';

export { useDraftPrompt } from './useDraftPrompt';

export {
  useConnectionQuality,
  type ConnectionQuality,
  type ConnectionMetrics,
} from './useConnectionQuality';
