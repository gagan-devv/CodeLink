import WebSocket from 'ws';
import * as crypto from 'crypto';
import { buildEnvelope, MessageType } from '@codelink/protocol'

interface WsClientOptions {
  onMessage: (type: string, payload: unknown, id: string) => void;
  onConnected: () => void;
  onDisconnected: () => void;
}

export class WsClient {
    private ws: WebSocket | null = null;
    private token: string | null = null;
    private url: string | null = null;
    private reconnectDelay = 1_000;
    private readonly MAX_DELAY = 30_000;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private sendQueue: string[] = [];
    private outSeq = 0;
    private connected = false;
    private intentionalClose = false;
    
    constructor(private readonly opts: WsClientOptions) {}

    connect(url: string, token: string): void {
        this.url = url;
        this.token = token;
        this.intentionalClose = false;
        this._connect();
    }

    private _connect(): void {
        if (!this.url || !this.token) { return; }

        const wsUrl = `${this.url}?token=${encodeURIComponent(this.token)}`;
        this.ws = new WebSocket(wsUrl, {
            perMessageDeflate: true,
        });

        this.ws.on('open', () => {
            this.connected = true;
            this.reconnectDelay = 1_000;
            this.opts.onConnected();
            this.flushQueue();
        });

        this.ws.on('message', (data: Buffer) => {
            try {
                const envelope = JSON.parse(data.toString('utf8')) as {
                    type: string;
                    payload: unknown;
                    id: string;
                };
                this.opts.onMessage(envelope.type, envelope.payload, envelope.id);
            } catch {

            }
        });

        this.ws.on('close', () => {
            this.connected = false;
            this.opts.onDisconnected();
            if (!this.intentionalClose) {
                this.scheduleReconnect();
            }
        });

        this.ws.on('error', () => {
            this.ws?.terminate();;
        });
    }

    send(type: MessageType, payload: unknown): void {
        const envelope = JSON.stringify(buildEnvelope(type as any, payload as any));

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(envelope);
        } else {
            this.sendQueue.push(envelope);
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    disconnect(): void {
        this.intentionalClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.ws?.close(1000, 'extension deactivated');
        this.ws = null;
        this.connected = false;
    }

    private flushQueue(): void {
        while (this.sendQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(this.sendQueue.shift()!);
        }
    }

    private scheduleReconnect(): void {
        const jitter = Math.random() * 500;
        this.reconnectTimer = setTimeout(() => {
            this._connect();
        }, this.reconnectDelay + jitter);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.MAX_DELAY);
    }
}