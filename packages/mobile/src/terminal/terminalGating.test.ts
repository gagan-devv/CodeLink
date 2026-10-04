import { describe, it, expect } from 'vitest';
import { isTerminalFeatureFlagEnabled, isTerminalTabVisible } from './terminalGating';

describe('terminalGating', () => {
  describe('isTerminalFeatureFlagEnabled', () => {
    it('returns false when env var is undefined (default false)', () => {
      expect(isTerminalFeatureFlagEnabled(undefined)).toBe(false);
    });

    it('returns false when env var is empty string or "false"', () => {
      expect(isTerminalFeatureFlagEnabled('')).toBe(false);
      expect(isTerminalFeatureFlagEnabled('false')).toBe(false);
      expect(isTerminalFeatureFlagEnabled('0')).toBe(false);
    });

    it('returns true when env var is "true" or "1"', () => {
      expect(isTerminalFeatureFlagEnabled('true')).toBe(true);
      expect(isTerminalFeatureFlagEnabled('1')).toBe(true);
    });
  });

  describe('isTerminalTabVisible', () => {
    it('hides tab when feature flag is disabled even if paired', () => {
      expect(isTerminalTabVisible('paired', undefined)).toBe(false);
      expect(isTerminalTabVisible('paired', 'false')).toBe(false);
      expect(isTerminalTabVisible('paired', '0')).toBe(false);
    });

    it('hides tab when feature flag is enabled but companion is unpaired', () => {
      expect(isTerminalTabVisible('unpaired', 'true')).toBe(false);
      expect(isTerminalTabVisible('initiating', 'true')).toBe(false);
      expect(isTerminalTabVisible('pending_approval', 'true')).toBe(false);
      expect(isTerminalTabVisible('error', 'true')).toBe(false);
    });

    it('shows tab only when feature flag is enabled AND companion is paired', () => {
      expect(isTerminalTabVisible('paired', 'true')).toBe(true);
      expect(isTerminalTabVisible('paired', '1')).toBe(true);
    });
  });
});
