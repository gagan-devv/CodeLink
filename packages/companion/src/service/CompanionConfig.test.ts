import { describe, it, expect, afterEach } from 'vitest';
import { CompanionConfig } from './CompanionConfig';
import * as fs from 'fs';
import * as path from 'path';

describe('CompanionConfig', () => {
  const testConfigPath = path.join(process.cwd(), 'scratch-config-test.json');

  afterEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  it('defaults to disabled (feature OFF by default)', () => {
    const config = new CompanionConfig(testConfigPath);
    expect(config.isEnabled()).toBe(false);
    expect(config.get().recordingEnabled).toBe(false);
    expect(config.get().maxSessions).toBe(8);
    expect(config.get().idleTimeoutMs).toBe(6 * 60 * 60 * 1000); // 6 hours
  });

  it('can enable and disable feature and persist to config file', () => {
    const config = new CompanionConfig(testConfigPath);
    expect(config.isEnabled()).toBe(false);

    config.setEnabled(true);
    expect(config.isEnabled()).toBe(true);

    // Read back with a new instance
    const reloaded = new CompanionConfig(testConfigPath);
    expect(reloaded.isEnabled()).toBe(true);

    reloaded.setEnabled(false);
    expect(reloaded.isEnabled()).toBe(false);
  });
});
