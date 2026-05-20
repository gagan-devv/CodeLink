"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchEncoder = void 0;
const dmp = __importStar(require("diff-match-patch"));
class PatchEncoder {
    constructor() {
        this.engine = new dmp.diff_match_patch();
        this.lastSent = new Map();
    }
    encode(fileName, newContent, isDirty) {
        const last = this.lastSent.get(fileName);
        if (!last) {
            return null;
        }
        if (last.content === newContent) {
            return null;
        }
        const patches = this.engine.patch_make(last.content, newContent);
        const patchText = this.engine.patch_toText(patches);
        const toSeq = last.seq + 1;
        this.lastSent.set(fileName, { content: newContent, seq: toSeq });
        return { fileName, patches: patchText, fromSeq: last.seq.toString(), toSeq: toSeq.toString(), isDirty, timestamp: Date.now() };
    }
    recordSnapshot(fileName, content, seq) {
        this.lastSent.set(fileName, { content, seq });
    }
    reset(fileName) {
        this.lastSent.delete(fileName);
    }
    resetAll() {
        this.lastSent.clear();
    }
}
exports.PatchEncoder = PatchEncoder;
//# sourceMappingURL=PatchEncoder.js.map