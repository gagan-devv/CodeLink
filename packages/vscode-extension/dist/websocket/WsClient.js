"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsClient = void 0;
const ws_1 = __importDefault(require("ws"));
const protocol_1 = require("@codelink/protocol");
class WsClient {
    constructor(opts) {
        this.opts = opts;
        this.ws = null;
        this.token = null;
        this.url = null;
        this.reconnectDelay = 1000;
        this.MAX_DELAY = 30000;
        this.reconnectTimer = null;
        this.sendQueue = [];
        this.outSeq = 0;
        this.connected = false;
        this.intentionalClose = false;
    }
    connect(url, token) {
        this.url = url;
        this.token = token;
        this.intentionalClose = false;
        this._connect();
    }
    _connect() {
        if (!this.url || !this.token) {
            return;
        }
        const wsUrl = `${this.url}?token=${encodeURIComponent(this.token)}`;
        this.ws = new ws_1.default(wsUrl, {
            perMessageDeflate: true,
        });
        this.ws.on('open', () => {
            this.connected = true;
            this.reconnectDelay = 1000;
            this.opts.onConnected();
            this.flushQueue();
        });
        this.ws.on('message', (data) => {
            try {
                const envelope = JSON.parse(data.toString('utf8'));
                this.opts.onMessage(envelope.type, envelope.payload, envelope.id);
            }
            catch {
                // ignore parsing failures
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
            this.ws?.terminate();
        });
    }
    send(type, payload) {
        const envelope = JSON.stringify((0, protocol_1.buildEnvelope)(type, payload));
        if (this.ws?.readyState === ws_1.default.OPEN) {
            this.ws.send(envelope);
        }
        else {
            this.sendQueue.push(envelope);
        }
    }
    isConnected() {
        return this.connected;
    }
    disconnect() {
        this.intentionalClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.ws?.close(1000, 'extension deactivated');
        this.ws = null;
        this.connected = false;
    }
    flushQueue() {
        while (this.sendQueue.length > 0 && this.ws?.readyState === ws_1.default.OPEN) {
            this.ws.send(this.sendQueue.shift());
        }
    }
    scheduleReconnect() {
        const jitter = Math.random() * 500;
        this.reconnectTimer = setTimeout(() => {
            this._connect();
        }, this.reconnectDelay + jitter);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.MAX_DELAY);
    }
}
exports.WsClient = WsClient;
//# sourceMappingURL=WsClient.js.map