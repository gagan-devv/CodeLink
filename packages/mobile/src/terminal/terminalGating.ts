/**
 * CodeLink Mobile Terminal Gating Logic
 *
 * The Terminal tab is hidden unless:
 * 1. EXPO_PUBLIC_TERMINAL_ENABLED feature flag is explicitly enabled ('true' or '1').
 * 2. A terminal-capable companion is actively paired (e2eeState === 'paired').
 */

export function isTerminalFeatureFlagEnabled(
  envVal: string | undefined = process.env.EXPO_PUBLIC_TERMINAL_ENABLED
): boolean {
  return envVal === 'true' || envVal === '1';
}

export function isTerminalTabVisible(
  e2eeState: string,
  envVal: string | undefined = process.env.EXPO_PUBLIC_TERMINAL_ENABLED
): boolean {
  return isTerminalFeatureFlagEnabled(envVal) && e2eeState === 'paired';
}
