import { MessageType, PayloadFor } from '@codelink/protocol';
interface WsClientOptions {
    onMessage: (type: string, payload: unknown, id: string) => void;
    onConnected: () => void;
    onDisconnected: () => void;
}
export declare class WsClient {
    private readonly opts;
    private ws;
    private token;
    private url;
    private reconnectDelay;
    private readonly MAX_DELAY;
    private reconnectTimer;
    private sendQueue;
    private outSeq;
    private connected;
    private intentionalClose;
    constructor(opts: WsClientOptions);
    connect(url: string, token: string): void;
    private _connect;
    send<T extends MessageType>(type: T, payload: PayloadFor<T>): void;
    isConnected(): boolean;
    disconnect(): void;
    private flushQueue;
    private scheduleReconnect;
}
export {};
//# sourceMappingURL=WsClient.d.ts.map