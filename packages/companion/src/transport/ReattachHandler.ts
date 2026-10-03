import { RingBuffer } from '../session/RingBuffer';
import { TerminalGapPayload } from '@codelink/protocol';

export interface ReattachResult {
  hasGap: boolean;
  data: string;
  nextOffset: number;
  gapNotice?: TerminalGapPayload;
}

export class ReattachHandler {
  constructor(private ringBuffer: RingBuffer) {}

  public handleReattach(sessionId: string, lastProcessedOffset: number): ReattachResult {
    const read = this.ringBuffer.readFrom(lastProcessedOffset);

    if (read.hasGap) {
      const retainedOffset = Math.max(
        0,
        this.ringBuffer.totalBytesWritten - Buffer.byteLength(read.data, 'utf8')
      );
      const gapNotice: TerminalGapPayload = {
        sessionId,
        requestedOffset: lastProcessedOffset,
        retainedOffset,
      };

      return {
        hasGap: true,
        data: read.data,
        nextOffset: read.nextOffset,
        gapNotice,
      };
    }

    return {
      hasGap: false,
      data: read.data,
      nextOffset: read.nextOffset,
    };
  }
}
