import { TerminalInputAckPayload } from '@codelink/protocol';

export interface DedupResult {
  isDuplicate: boolean;
  ack: TerminalInputAckPayload;
}

export class InputDeduplicator {
  // Map generation -> Set of inputIds
  private generationMap = new Map<number, Set<string>>();
  private readonly maxTrackedPerGen = 2000;

  public processInput(inputId: string, generation: number, sessionId = ''): DedupResult {
    let set = this.generationMap.get(generation);
    if (!set) {
      set = new Set<string>();
      this.generationMap.set(generation, set);
    }

    const ack: TerminalInputAckPayload = {
      sessionId,
      inputId,
      generation,
    };

    if (set.has(inputId)) {
      return {
        isDuplicate: true,
        ack,
      };
    }

    // Prune if exceeds maxTracked
    if (set.size >= this.maxTrackedPerGen) {
      const first = set.values().next().value;
      if (first) {
        set.delete(first);
      }
    }

    set.add(inputId);
    return {
      isDuplicate: false,
      ack,
    };
  }

  public clear(): void {
    this.generationMap.clear();
  }
}
