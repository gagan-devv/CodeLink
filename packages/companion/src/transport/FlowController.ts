export interface FlowControllerOptions {
  initialCredits?: number;
  lowWatermark?: number;
  highWatermark?: number;
}

export interface QueuedMessage {
  type: 'control' | 'bulk';
  data: string;
}

export class FlowController {
  public remainingCredits: number;
  public readonly initialCredits: number;
  public readonly lowWatermark: number;
  public readonly highWatermark: number;

  private priorityQueue: string[] = [];
  private bulkQueue: string[] = [];

  constructor(options: FlowControllerOptions = {}) {
    this.initialCredits = options.initialCredits ?? 64 * 1024;
    this.remainingCredits = this.initialCredits;
    this.lowWatermark =
      options.lowWatermark ?? Math.min(8 * 1024, Math.floor(this.initialCredits / 5));
    this.highWatermark = options.highWatermark ?? Math.floor(this.initialCredits * 0.8);
  }

  public isPaused(): boolean {
    return this.remainingCredits <= this.lowWatermark;
  }

  public canSend(bytes: number): boolean {
    return this.remainingCredits >= bytes;
  }

  public consume(bytes: number): void {
    this.remainingCredits -= bytes;
    if (this.remainingCredits < 0) {
      this.remainingCredits = 0;
    }
  }

  public replenish(bytes: number): void {
    this.remainingCredits += bytes;
  }

  public enqueuePriorityControl(data: string): void {
    this.priorityQueue.push(data);
  }

  public enqueueOutput(data: string): void {
    this.bulkQueue.push(data);
  }

  public dequeue(): QueuedMessage | null {
    if (this.priorityQueue.length > 0) {
      const data = this.priorityQueue.shift()!;
      return { type: 'control', data };
    }
    if (this.bulkQueue.length > 0) {
      const data = this.bulkQueue.shift()!;
      return { type: 'bulk', data };
    }
    return null;
  }

  public reset(): void {
    this.priorityQueue = [];
    this.bulkQueue = [];
    this.remainingCredits = this.initialCredits;
  }
}
