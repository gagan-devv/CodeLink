// React Native exposes WebSocket globally — no import needed.

type MessageHandler    = (type: string, payload: unknown, id: string) => void;
type ConnectionHandler = () => void;

class WsManagerClass {
  private ws:             WebSocket | null = null;
  private url:            string | null    = null;
  private token:          string | null    = null;
  private reconnectDelay  = 1_000;
  private readonly MAX    = 30_000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  onMessage:      MessageHandler    = () => {};
  onConnected:    ConnectionHandler = () => {};
  onDisconnected: ConnectionHandler = () => {};

  connect(url: string, token: string): void {
    this.url             = url;
    this.token           = token;
    this.intentionalClose = false;
    this._open();
  }

  private _open(): void {
    if (!this.url || !this.token) { return; }

    const wsUrl = `${this.url}?token=${encodeURIComponent(this.token)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectDelay = 1_000;
      this.onConnected();
    };

    this.ws.onmessage = ({ data }: MessageEvent<string>) => {
      try {
        const e = JSON.parse(data) as { type: string; payload: unknown; id: string };
        this.onMessage(e.type, e.payload, e.id ?? '');
      } catch { /* malformed — ignore */ }
    };

    this.ws.onclose = () => {
      this.onDisconnected();
      if (!this.intentionalClose) { this._scheduleReconnect(); }
    };

    this.ws.onerror = () => { this.ws?.close(); };
  }

  send(type: string, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        v:   1,
        id:  Math.random().toString(36).slice(2),
        ts:  Date.now(),
        type,
        payload,
      }));
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); }
    this.ws?.close(1000, 'user action');
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private _scheduleReconnect(): void {
    const jitter = Math.random() * 500;
    this.reconnectTimer = setTimeout(() => this._open(), this.reconnectDelay + jitter);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.MAX);
  }
}

export const wsManager = new WsManagerClass();