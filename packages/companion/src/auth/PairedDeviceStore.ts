import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface PairedDevice {
  deviceId: string;
  deviceName: string;
  publicKey: string;
  pairedAt: number;
  revoked: boolean;
}

export class PairedDeviceStore {
  private devices = new Map<string, PairedDevice>();
  private filePath: string;

  constructor(customPath?: string) {
    this.filePath = customPath || path.join(os.homedir(), '.codelink', 'paired_devices.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const list: PairedDevice[] = JSON.parse(raw);
        for (const dev of list) {
          this.devices.set(dev.deviceId, dev);
        }
      }
    } catch (err) {
      console.warn('[PairedDeviceStore] Failed to load store, initializing empty:', err);
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      const data = JSON.stringify(Array.from(this.devices.values()), null, 2);
      fs.writeFileSync(this.filePath, data, {
        encoding: 'utf8',
        mode: 0o600,
      });
    } catch (err) {
      console.error('[PairedDeviceStore] Failed to save paired devices:', err);
    }
  }

  public addDevice(params: { deviceId: string; deviceName: string; publicKey: string }): void {
    const device: PairedDevice = {
      deviceId: params.deviceId,
      deviceName: params.deviceName,
      publicKey: params.publicKey,
      pairedAt: Date.now(),
      revoked: false,
    };
    this.devices.set(device.deviceId, device);
    this.save();
  }

  public isApproved(deviceId: string): boolean {
    const dev = this.devices.get(deviceId);
    if (!dev) {
      return false;
    }
    return !dev.revoked;
  }

  public revokeDevice(deviceId: string): boolean {
    const dev = this.devices.get(deviceId);
    if (!dev) {
      return false;
    }
    dev.revoked = true;
    this.save();
    return true;
  }

  public getDevice(deviceId: string): PairedDevice | undefined {
    return this.devices.get(deviceId);
  }

  public list(): PairedDevice[] {
    return Array.from(this.devices.values());
  }
}
