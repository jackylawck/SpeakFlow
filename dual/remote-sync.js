/**
 * [Integration-Tested Module]
 * 順住講 SpeakFlow 雙機高韌性同步傳輸層 (v2.0.0)
 */
const PEER_PREFIX = "speakflow-v1-";
const DIRECTOR_TOKEN_KEY = "tp_director_device_token";
const DIRECTOR_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_DURATION_MS = 5 * 60 * 1000;

const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" }
    ],
    iceCandidatePoolSize: 4
  }
};

const ALLOWED_TYPES = new Set([
  "DIRECTOR_HELLO",
  "PROMPTER_READY",
  "AUTH_REJECTED",
  "PIN_LOCKED",
  "ROOM_LOCKED",
  "CMD_TOGGLE",
  "CMD_NEXT",
  "CMD_PREV",
  "CMD_GOTO",
  "CMD_RESTART",
  "CMD_MIRROR_X",
  "CMD_MIRROR_Y",
  "CMD_CONTRAST",
  "CMD_EYELINE",
  "CMD_PUSH_SCRIPT",
  "STATE_SYNC",
  "STATE_INDEX"
]);

export function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 6; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function generatePinCode() {
  const range = 900000;
  const limit = Math.floor(0x100000000 / range) * range;
  const buf = new Uint32Array(1);
  let val;
  do {
    crypto.getRandomValues(buf);
    val = buf[0];
  } while (val >= limit);
  return String(100000 + (val % range));
}

export function getOrCreateDirectorToken() {
  try {
    const raw = localStorage.getItem(DIRECTOR_TOKEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.token === "string" && Date.now() < Number(parsed.expiresAt)) {
        return parsed.token;
      }
    }
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    const token = "dir_" + Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(
      DIRECTOR_TOKEN_KEY,
      JSON.stringify({ token, expiresAt: Date.now() + DIRECTOR_TOKEN_TTL_MS })
    );
    return token;
  } catch {
    return "dir_" + Math.random().toString(36).slice(2, 12);
  }
}

export class DualDeviceBridge {
  constructor({ onMessage, onConnectionChange, onError, onReconnecting }) {
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
    this.onError = onError;
    this.onReconnecting = onReconnecting;

    this.role = "solo";
    this.roomCode = "";
    this.pinCode = "";
    this.directorToken = null;
    this.lockedDirectorToken = null;
    this.authenticated = false;

    this._pinFailures = 0;
    this._pinLockedUntil = 0;
    this._authResolver = null;
    this._authRejecter = null;

    this.peer = null;
    this.conn = null;
    this.bc = null;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
  }

  _settleAuth(isSuccess, err = null) {
    const resolve = this._authResolver;
    const reject = this._authRejecter;
    this._authResolver = null;
    this._authRejecter = null;

    if (isSuccess) {
      resolve?.();
    } else if (err) {
      reject?.(err);
    }
  }

  _teardownAndLaunch(launchFn) {
    clearTimeout(this._reconnectTimer);
    if (this.bc) {
      this.bc.close();
      this.bc = null;
    }
    if (this.conn) {
      try { this.conn.close(); } catch {}
      this.conn = null;
    }

    let isLaunched = false;
    const launchOnce = () => {
      if (isLaunched) return;
      isLaunched = true;
      try {
        const res = launchFn();
        if (res && typeof res.catch === "function") {
          res.catch((err) => this._settleAuth(false, err));
        }
      } catch (err) {
        this._settleAuth(false, err);
      }
    };

    if (this.peer && !this.peer.destroyed) {
      const oldPeer = this.peer;
      this.peer = null;
      oldPeer.on("close", launchOnce);
      try {
        oldPeer.destroy();
      } catch {
        launchOnce();
      }
      setTimeout(launchOnce, 500);
    } else {
      this.peer = null;
      launchOnce();
    }
  }

  async startHost(roomCode, pinCode) {
    this.role = "prompter";
    this.roomCode = roomCode.toUpperCase();
    this.pinCode = String(pinCode);
    this.authenticated = false;
    this.lockedDirectorToken = null;
    this._pinFailures = 0;
    this._pinLockedUntil = 0;
    this._reconnectAttempts = 0;

    let PeerClass = null;
    try {
      const mod = await import("../vendor/peerjs.esm.js");
      PeerClass = mod.Peer;
    } catch (err) {
      this._teardownAndLaunch(() => this._initBroadcastChannel());
      this.onError?.(err);
      return;
    }

    this._teardownAndLaunch(() => {
      this._initBroadcastChannel();
      this.peer = new PeerClass(`${PEER_PREFIX}${this.roomCode}`, PEER_CONFIG);

      this.peer.on("open", () => {
        this._reconnectAttempts = 0;
      });

      this.peer.on("disconnected", () => {
        if (!this.peer || this.peer.destroyed) return;
        if (this._reconnectAttempts < 5) {
          this._reconnectAttempts++;
          const delay = Math.pow(2, this._reconnectAttempts) * 1000;
          this.onReconnecting?.(this._reconnectAttempts, delay);
          this._reconnectTimer = setTimeout(() => {
            if (this.peer && !this.peer.destroyed) {
              try { this.peer.reconnect(); } catch {}
            }
          }, delay);
        }
      });

      this.peer.on("connection", (incomingConn) => {
        this._attachConnection(incomingConn);
      });

      this.peer.on("error", (err) => {
        this.onError?.(err);
      });
    });
  }

  async connectDirector(roomCode, pinCode) {
    this.role = "director";
    this.roomCode = roomCode.toUpperCase().trim();
    this.pinCode = String(pinCode).trim();
    this.directorToken = getOrCreateDirectorToken();
    this.authenticated = false;
    this._reconnectAttempts = 0;

    return new Promise((resolve, reject) => {
      const overallTimeout = setTimeout(() => {
        this._settleAuth(false, new Error("CONNECTION_TIMEOUT"));
      }, 10000);

      this._authResolver = () => {
        clearTimeout(overallTimeout);
        resolve();
      };

      this._authRejecter = (err) => {
        clearTimeout(overallTimeout);
        reject(err);
      };

      this._teardownAndLaunch(async () => {
        // 1. 先嘗試同機 BroadcastChannel 快速交握（450ms）
        this._initBroadcastChannel();
        this.send("DIRECTOR_HELLO", { v: 1, pin: this.pinCode, token: this.directorToken });

        await new Promise((r) => setTimeout(r, 450));
        if (!this._authResolver || this.authenticated) return;

        // 2. 同機無回應，載入本地自託管 PeerJS 建立跨裝置 WebRTC 連線
        let PeerClass = null;
        try {
          const mod = await import("../vendor/peerjs.esm.js");
          PeerClass = mod.Peer;
        } catch {
          this._settleAuth(false, new Error("SDK_MISSING"));
          return;
        }

        if (!this._authResolver) return;

        const peerInstance = new PeerClass(PEER_CONFIG);
        this.peer = peerInstance;

        peerInstance.on("open", () => {
          if (!this._authResolver) {
            try { peerInstance.destroy(); } catch {}
            return;
          }
          const outgoingConn = peerInstance.connect(`${PEER_PREFIX}${this.roomCode}`, { reliable: true });
          this.conn = outgoingConn;

          outgoingConn.on("open", () => {
            if (!this._authResolver || this.authenticated) {
              try { outgoingConn.close(); } catch {}
              try { peerInstance.destroy(); } catch {}
              return;
            }
            this._attachConnection(outgoingConn);
            this.send("DIRECTOR_HELLO", { v: 1, pin: this.pinCode, token: this.directorToken });
          });

          outgoingConn.on("error", (err) => {
            this._settleAuth(false, err);
          });
        });

        peerInstance.on("error", (err) => {
          this._settleAuth(false, err);
        });
      });
    });
  }

  send(type, payload = {}) {
    if (!ALLOWED_TYPES.has(type)) return;
    if (
      this.role === "prompter" &&
      !this.authenticated &&
      type !== "AUTH_REJECTED" &&
      type !== "PIN_LOCKED" &&
      type !== "ROOM_LOCKED"
    ) {
      return;
    }
    const packet = {
      type,
      payload,
      targetRole: this.role === "prompter" ? "director" : "prompter",
      ts: Date.now()
    };
    if (this.bc) {
      this.bc.postMessage(packet);
    }
    if (this.conn && this.conn.open) {
      this.conn.send(packet);
    }
  }

  destroy() {
    clearTimeout(this._reconnectTimer);
    // P1: 主動銷毀或切換分頁時，靜默拒絕掛起的認證 Promise，避免 10 秒後誤彈超時提示
    this._settleAuth(false, Object.assign(new Error("ABORTED"), { silent: true }));
    this.authenticated = false;
    this.lockedDirectorToken = null;
    if (this.bc) {
      this.bc.close();
      this.bc = null;
    }
    if (this.conn) {
      try { this.conn.close(); } catch {}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
    this.role = "solo";
  }

  _initBroadcastChannel() {
    if ("BroadcastChannel" in window) {
      this.bc = new BroadcastChannel(`speakflow_bc_${this.roomCode}`);
      this.bc.onmessage = (ev) => this._handleIncoming(ev.data, null);
    }
  }

  _attachConnection(conn) {
    if (!conn || conn._bound) return;
    conn._bound = true;

    conn.on("data", (data) => this._handleIncoming(data, conn));
    conn.on("close", () => {
      if (this.conn === conn) {
        this.authenticated = false;
        this.onConnectionChange?.(false);
      }
    });
    conn.on("error", () => {
      if (this.conn === conn) {
        this.authenticated = false;
        this.onConnectionChange?.(false);
      }
    });
  }

  _handleIncoming(data, sourceConn) {
    if (!data || typeof data !== "object" || !ALLOWED_TYPES.has(data.type)) return;
    if (data.targetRole && data.targetRole !== this.role) return;

    const payload = data.payload || {};

    if (this.role === "prompter" && data.type === "DIRECTOR_HELLO") {
      const now = Date.now();
      if (now < this._pinLockedUntil) {
        const remainSec = Math.ceil((this._pinLockedUntil - now) / 1000);
        this._rejectConn(sourceConn, "PIN_LOCKED", { remainSec });
        return;
      }

      const incomingPin = String(payload.pin || "");
      const incomingToken = String(payload.token || "").slice(0, 32);

      if (incomingPin !== this.pinCode || !incomingToken) {
        this._pinFailures++;
        if (this._pinFailures >= MAX_PIN_ATTEMPTS) {
          this._pinLockedUntil = now + PIN_LOCK_DURATION_MS;
          this._pinFailures = 0;
          this.onError?.(new Error("PIN_LOCKED_HOST"));
          this._rejectConn(sourceConn, "PIN_LOCKED", { remainSec: Math.ceil(PIN_LOCK_DURATION_MS / 1000) });
        } else {
          this._rejectConn(sourceConn, "AUTH_REJECTED", { remaining: MAX_PIN_ATTEMPTS - this._pinFailures });
        }
        return;
      }

      this._pinFailures = 0;

      if (this.lockedDirectorToken && this.lockedDirectorToken !== incomingToken) {
        this._rejectConn(sourceConn, "ROOM_LOCKED", {});
        return;
      }

      if (sourceConn && this.conn && this.conn !== sourceConn) {
        try { this.conn.close(); } catch {}
      }
      if (sourceConn) this.conn = sourceConn;

      this.lockedDirectorToken = incomingToken;
      this.authenticated = true;
      this.send("PROMPTER_READY", { v: 1 });
      this.onConnectionChange?.(true);
      return;
    }

    if (this.role === "director" && data.type === "PROMPTER_READY") {
      this.authenticated = true;
      this.onConnectionChange?.(true);
      this._settleAuth(true);
      return;
    }

    if (
      this.role === "director" &&
      (data.type === "AUTH_REJECTED" || data.type === "PIN_LOCKED" || data.type === "ROOM_LOCKED")
    ) {
      const err = new Error(data.type);
      err.meta = payload;
      this._settleAuth(false, err);
      this.onError?.(err);
      return;
    }

    if (!this.authenticated) return;
    this.onMessage?.(data.type, payload);
  }

  _rejectConn(sourceConn, rejectType, payload = {}) {
    const packet = {
      type: rejectType,
      payload,
      targetRole: "director",
      ts: Date.now()
    };
    if (sourceConn && sourceConn.open) {
      try { sourceConn.send(packet); } catch {}
      setTimeout(() => {
        try { sourceConn.close(); } catch {}
      }, 200);
    } else if (this.bc) {
      this.bc.postMessage(packet);
    }
  }
}
