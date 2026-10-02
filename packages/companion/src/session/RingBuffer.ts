export interface RingReadResult {
  hasGap: boolean;
  data: string;
  nextOffset: number;
}

interface Chunk {
  offset: number;
  data: string;
  byteLength: number;
}

export class RingBuffer {
  private chunks: Chunk[] = [];
  private currentBytes = 0;
  public totalBytesWritten = 0;

  constructor(public readonly capacityBytes: number = 1024 * 1024) {}

  public write(data: string): void {
    if (!data || data.length === 0) {
      return;
    }
    const byteLength = Buffer.byteLength(data, 'utf8');
    const offset = this.totalBytesWritten;
    this.totalBytesWritten += byteLength;

    this.chunks.push({ offset, data, byteLength });
    this.currentBytes += byteLength;

    // Prune chunks that exceed capacity
    while (this.currentBytes > this.capacityBytes && this.chunks.length > 0) {
      const first = this.chunks[0];
      const excess = this.currentBytes - this.capacityBytes;
      if (first.byteLength <= excess) {
        this.chunks.shift();
        this.currentBytes -= first.byteLength;
      } else {
        // Partially trim the first chunk
        // To be safe with UTF-8, convert to Buffer, slice, and convert back
        const buf = Buffer.from(first.data, 'utf8');
        const trimmedBuf = buf.subarray(excess);
        const trimmedStr = trimmedBuf.toString('utf8');
        const trimmedByteLength = trimmedBuf.length;

        first.offset += excess;
        first.data = trimmedStr;
        first.byteLength = trimmedByteLength;
        this.currentBytes -= excess;
        break;
      }
    }
  }

  public readFrom(requestedOffset: number): RingReadResult {
    const earliestRetained =
      this.chunks.length > 0 ? this.chunks[0].offset : this.totalBytesWritten;

    if (requestedOffset < earliestRetained) {
      // Offset has fallen off the ring buffer -> GAP!
      const fullRetained = this.chunks.map((c) => c.data).join('');
      return {
        hasGap: true,
        data: fullRetained,
        nextOffset: this.totalBytesWritten,
      };
    }

    if (requestedOffset >= this.totalBytesWritten) {
      return {
        hasGap: false,
        data: '',
        nextOffset: this.totalBytesWritten,
      };
    }

    // Build the slice from requestedOffset to totalBytesWritten
    let result = '';
    for (const chunk of this.chunks) {
      const chunkEnd = chunk.offset + chunk.byteLength;
      if (requestedOffset < chunkEnd) {
        if (requestedOffset <= chunk.offset) {
          result += chunk.data;
        } else {
          // Chunk contains requestedOffset
          const skipBytes = requestedOffset - chunk.offset;
          const buf = Buffer.from(chunk.data, 'utf8');
          result += buf.subarray(skipBytes).toString('utf8');
        }
      }
    }

    return {
      hasGap: false,
      data: result,
      nextOffset: this.totalBytesWritten,
    };
  }

  public clear(): void {
    this.chunks = [];
    this.currentBytes = 0;
  }
}
