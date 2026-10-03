import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionRecorder } from './SessionRecorder';

describe('SessionRecorder', () => {
  let tempDir: string;
  let recorder: SessionRecorder;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codelink-rec-test-'));
    recorder = new SessionRecorder({ recordDir: tempDir, enabled: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('creates asciinema v2 recording file with 0600 permissions', () => {
    const filePath = recorder.startRecording('sess-rec-1', 'Bash Shell', 80, 24);
    expect(fs.existsSync(filePath)).toBe(true);

    const stat = fs.statSync(filePath);
    expect(stat.mode & 0o777).toBe(0o600);

    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(1);
    const header = JSON.parse(lines[0]);
    expect(header.version).toBe(2);
    expect(header.width).toBe(80);
    expect(header.height).toBe(24);
    expect(header.title).toBe('Bash Shell');
  });

  it('records output frames with relative timestamp and event type "o"', () => {
    const filePath = recorder.startRecording('sess-rec-2', 'Output Test', 80, 24);
    recorder.recordOutput('sess-rec-2', 'echo hello\r\n');
    recorder.recordOutput('sess-rec-2', 'hello\r\n');
    recorder.stopRecording('sess-rec-2');

    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(3); // header + 2 events

    const event1 = JSON.parse(lines[1]);
    expect(Array.isArray(event1)).toBe(true);
    expect(typeof event1[0]).toBe('number'); // timestamp offset
    expect(event1[1]).toBe('o');
    expect(event1[2]).toBe('echo hello\r\n');

    const event2 = JSON.parse(lines[2]);
    expect(event2[1]).toBe('o');
    expect(event2[2]).toBe('hello\r\n');
  });

  it('does nothing when recording is disabled', () => {
    const disabledRecorder = new SessionRecorder({ recordDir: tempDir, enabled: false });
    const filePath = disabledRecorder.startRecording('sess-rec-3', 'Disabled', 80, 24);
    expect(filePath).toBe('');
    expect(disabledRecorder.isRecording('sess-rec-3')).toBe(false);

    disabledRecorder.recordOutput('sess-rec-3', 'data');
    disabledRecorder.stopRecording('sess-rec-3');
  });
});
