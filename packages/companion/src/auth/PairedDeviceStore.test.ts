import { describe, it, expect, afterEach } from 'vitest';
import { PairedDeviceStore } from './PairedDeviceStore';
import * as fs from 'fs';
import * as path from 'path';

describe('PairedDeviceStore', () => {
  const testStorePath = path.join(process.cwd(), 'scratch-devices-test.json');

  afterEach(() => {
    if (fs.existsSync(testStorePath)) {
      fs.unlinkSync(testStorePath);
    }
  });

  it('saves and checks approved devices with 0600 file permissions', () => {
    const store = new PairedDeviceStore(testStorePath);
    store.addDevice({
      deviceId: 'device-phone-1',
      deviceName: 'Pixel 9 Pro',
      publicKey: 'test-public-key-base64',
    });

    expect(store.isApproved('device-phone-1')).toBe(true);
    expect(store.isApproved('device-unknown')).toBe(false);

    // Verify 0600 permissions
    const stat = fs.statSync(testStorePath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('revokes an approved device and rejects future checks', () => {
    const store = new PairedDeviceStore(testStorePath);
    store.addDevice({
      deviceId: 'device-phone-2',
      deviceName: 'iPhone 16',
      publicKey: 'pubkey-123',
    });

    expect(store.isApproved('device-phone-2')).toBe(true);

    store.revokeDevice('device-phone-2');
    expect(store.isApproved('device-phone-2')).toBe(false);

    // Reload from file to ensure persistence
    const reloaded = new PairedDeviceStore(testStorePath);
    expect(reloaded.isApproved('device-phone-2')).toBe(false);
  });

  it('lists active and revoked devices', () => {
    const store = new PairedDeviceStore(testStorePath);
    store.addDevice({ deviceId: 'dev-1', deviceName: 'Dev 1', publicKey: 'pk1' });
    store.addDevice({ deviceId: 'dev-2', deviceName: 'Dev 2', publicKey: 'pk2' });
    store.revokeDevice('dev-1');

    const devices = store.list();
    expect(devices.length).toBe(2);
    expect(devices.find((d) => d.deviceId === 'dev-1')?.revoked).toBe(true);
    expect(devices.find((d) => d.deviceId === 'dev-2')?.revoked).toBe(false);
  });
});
