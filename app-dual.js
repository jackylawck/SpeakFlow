import { applyTranslations, toggleLang, t } from "./shared/i18n.js";
import { splitSentences } from "./shared/segmenter.js";
import { calculateSentenceDurationMs, calculateTotalDurationMs } from "./shared/pacing.js";
import { initScriptStorage } from "./shared/storage.js";
import { PrompterEngine, showToast } from "./shared/prompter-core.js";
import { createQrSvgElement } from "./dual/qr-svg.js";
import { initEasterEgg } from "./shared/easter-egg.js";

const PEER_PREFIX = "speakflow-room-";
const BC_PREFIX = "speakflow-bc-";
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;
const CONNECT_TIMEOUT_MS = 10 * 1000;
const MAX_PUSH_SCRIPT_CHARS = 50000;

let cachedPeerCtor = window.Peer || null;
let peerLoadAttempted = false;

async function resolvePeerCtor() {
  if (cachedPeerCtor) return cachedPeerCtor;
  if (peerLoadAttempted) return null;
  peerLoadAttempted = true;
  try {
    const mod = await import("./vendor/peerjs.esm.js");
    cachedPeerCtor = mod.Peer || mod.default || window.Peer || null;
  } catch {
    cachedPeerCtor = null;
  }
  return cachedPeerCtor;
}

function createSessionId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const els = {
  editorView: document.getElementById("editor-view"),
  prompterView: document.getElementById("prompter-view"),
  directorView: document.getElementById("director-view"),
  statsBadge: document.getElementById("stats-badge"),
  langBtn: document.getElementById("lang-btn"),
  roleTabs: document.querySelectorAll(".role-tab"),
  dualConfigPanel: document.getElementById("dual-config-panel"),
  prompterPairBox: document.getElementById("prompter-pair-box"),
  hostRoomCode: document.getElementById("host-room-code"),
  hostPinCode: document.getElementById("host-pin-code"),
  hostConnBadge: document.getElementById("host-conn-badge"),
  copyLinkBtn: document.getElementById("copy-link-btn"),
  resetPairBtn: document.getElementById("reset-pair-btn"),
  unlockDirectorBtn: document.getElementById("unlock-director-btn"),
  hostQrBox: document.getElementById("host-qr-box"),
  directorPairBox: document.getElementById("director-pair-box"),
  joinRoomInput: document.getElementById("join-room-input"),
  joinPinInput: document.getElementById("join-pin-input"),
  connectDirectorBtn: document.getElementById("connect-director-btn"),
  scriptInput: document.getElementById("script-input"),
  storageBar: document.querySelector(".storage-bar"),
  storageStatus: document.getElementById("storage-status"),
  saveLocalBtn: document.getElementById("save-local-btn"),
  clearStorageBtn: document.getElementById("clear-storage-btn"),
  editorSettingsGrid: document.getElementById("editor-settings-grid"),
  modeSelect: document.getElementById("mode-select"),
  pacingMode: document.getElementById("pacing-mode"),
  speedInput: document.getElementById("speed-input"),
  speedLabel: document.getElementById("speed-label"),
  fontSizeInput: document.getElementById("fontsize-input"),
  lineHeightInput: document.getElementById("lineheight-input"),
  fsVal: document.getElementById("fs-val"),
  lhVal: document.getElementById("lh-val"),
  startBtn: document.getElementById("start-btn"),
  eyeline: document.getElementById("eyeline"),
  prompterRemotePill: document.getElementById("prompter-remote-pill"),
  prompterRemoteText: document.getElementById("prompter-remote-text"),
  micBarWrap: document.getElementById("mic-bar-wrap"),
  micStatusText: document.getElementById("mic-status-text"),
  micLevelFill: document.getElementById("mic-level-fill"),
  stageViewport: document.getElementById("stage-viewport"),
  scrollTrack: document.getElementById("scroll-track"),
  backBtn: document.getElementById("back-btn"),
  prevBtn: document.getElementById("prev-btn"),
  toggleBtn: document.getElementById("toggle-btn"),
  nextBtn: document.getElementById("next-btn"),
  micBtn: document.getElementById("mic-btn"),
  contrastBtn: document.getElementById("contrast-btn"),
  eyelineBtn: document.getElementById("eyeline-btn"),
  mirrorXBtn: document.getElementById("mirror-x-btn"),
  mirrorYBtn: document.getElementById("mirror-y-btn"),
  restartBtn: document.getElementById("restart-btn"),
  progressLabel: document.getElementById("progress-label"),
  directorConnStatus: document.getElementById("director-conn-status"),
  directorMetaBadge: document.getElementById("director-meta-badge"),
  directorProgress: document.getElementById("director-progress"),
  directorExitBtn: document.getElementById("director-exit-btn"),
  directorScriptList: document.getElementById("director-script-list"),
  directorLiveTextarea: document.getElementById("director-live-textarea"),
  directorPushScriptBtn: document.getElementById("director-push-script-btn"),
  dirPrevBtn: document.getElementById("dir-prev-btn"),
  dirToggleBtn: document.getElementById("dir-toggle-btn"),
  dirNextBtn: document.getElementById("dir-next-btn"),
  dirRestartBtn: document.getElementById("dir-restart-btn"),
  dirEyelineBtn: document.getElementById("dir-eyeline-btn"),
  dirContrastBtn: document.getElementById("dir-contrast-btn"),
  dirMirrorXBtn: document.getElementById("dir-mirror-x-btn"),
  dirMirrorYBtn: document.getElementById("dir-mirror-y-btn"),
  micModal: document.getElementById("mic-modal"),
  micCancelBtn: document.getElementById("mic-cancel-btn"),
  micConfirmBtn: document.getElementById("mic-confirm-btn"),
  toastContainer: document.getElementById("toast-container")
};

const dualState = {
  role: "prompter",
  roomCode: "",
  pinCode: "",
  hostInitSeq: 0,
  hostPeer: null,
  hostBc: null,
  hostConnected: false,
  activeDirectorConn: null,
  lockedDirectorSessionId: null,
  failedPinAttempts: 0,
  lockoutUntil: 0,
  directorSessionId: createSessionId(),
  directorPeer: null,
  directorConn: null,
  directorBc: null,
  directorStatusKey: "connWaiting",
  connectTimeoutId: null,
  lastDirectorState: null,
  lastDirectorActiveIdx: -1,
  armedIdx: -1,
  armedTimer: null,
  lastArmHintAt: 0
};

const engine = new PrompterEngine({
  els,
  onIndexChange: () => broadcastIndexOnly(),
  onFullStateChange: () => broadcastFullState()
});

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function generatePinCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

function buildPairUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("room", dualState.roomCode);
  url.searchParams.set("pin", dualState.pinCode);
  return url.toString();
}

function renderHostQr() {
  if (!els.hostQrBox) return;
  const pairUrl = buildPairUrl();
  if (pairUrl.length > 260) {
    els.hostQrBox.textContent = "QR";
    showToast(els.toastContainer, t("toastQrTooLong"), true);
    return;
  }
  try {
    const svg = createQrSvgElement(pairUrl, 116);
    if (svg) {
      els.hostQrBox.replaceChildren(svg);
    } else {
      els.hostQrBox.textContent = "QR";
    }
  } catch {
    els.hostQrBox.textContent = "QR";
  }
}

function setHostConnectionUi(connected) {
  dualState.hostConnected = Boolean(connected);
  if (connected) {
    els.hostConnBadge.classList.add("connected");
    els.hostConnBadge.textContent = t("connConnected");
    // 鏡頭防穿幫設計：全螢幕讀稿時僅顯示已連線狀態，絕不暴露房號與 PIN
    els.prompterRemoteText.textContent = t("remoteConnected");
  } else {
    els.hostConnBadge.classList.remove("connected");
    els.hostConnBadge.textContent = t("connWaiting");
    els.prompterRemoteText.textContent = t("remoteStandby");
  }
}

function setDirectorStatusUi(key, connected = false) {
  dualState.directorStatusKey = key;
  els.directorConnStatus.classList.toggle("connected", connected);
  els.directorConnStatus.textContent = t(key);
}

function updateUnlockButtonVisibility() {
  const isLockedOut = Date.now() < dualState.lockoutUntil;
  const hasSessionLock = Boolean(dualState.lockedDirectorSessionId);
  els.unlockDirectorBtn.classList.toggle("hidden", !isLockedOut && !hasSessionLock);
}

function buildFullStatePayload() {
  const rawScript =
    engine.state.view === "prompter" ? engine.state.rawScript : els.scriptInput.value;
  const sentences = splitSentences(rawScript);
  const items =
    engine.state.view === "prompter"
      ? engine.state.items
      : sentences.map((text) => ({
          text,
          durationMs: calculateSentenceDurationMs(
            text,
            els.pacingMode.value,
            els.speedInput.value
          )
        }));

  return {
    type: "FULL_STATE",
    view: engine.state.view,
    mode: engine.state.view === "prompter" ? engine.state.mode : els.modeSelect.value,
    isPlaying: engine.state.isPlaying,
    currentIndex: engine.state.currentIndex,
    rawScript,
    items,
    visualState: engine.getVisualState()
  };
}

function sendToDirector(payload) {
  if (dualState.activeDirectorConn?.open) {
    dualState.activeDirectorConn.send(payload);
  }
  if (dualState.hostBc && dualState.lockedDirectorSessionId) {
    dualState.hostBc.postMessage({
      ...payload,
      targetSessionId: dualState.lockedDirectorSessionId
    });
  }
}

function broadcastFullState() {
  sendToDirector(buildFullStatePayload());
}

function broadcastIndexOnly() {
  sendToDirector({
    type: "STATE_INDEX",
    view: engine.state.view,
    mode: engine.state.mode,
    isPlaying: engine.state.isPlaying,
    currentIndex: engine.state.currentIndex,
    total: engine.state.items.length
  });
}

function handleDirectorCommand(msg) {
  if (!msg || typeof msg !== "object") return;

  switch (msg.type) {
    case "CMD_PREV":
      if (engine.state.view === "prompter" && engine.state.mode === "popup") {
        engine.goToChunk(engine.state.currentIndex - 1);
      }
      break;

    case "CMD_NEXT":
      if (engine.state.view === "prompter" && engine.state.mode === "popup") {
        engine.goToChunk(engine.state.currentIndex + 1);
      }
      break;

    case "CMD_TOGGLE":
      if (engine.state.view === "prompter") {
        engine.state.isPlaying ? engine.stopPlayback() : engine.startPlayback();
      }
      break;

    case "CMD_RESTART":
      if (engine.state.view === "prompter") {
        if (engine.state.mode === "popup") {
          engine.goToChunk(0);
          engine.startPlayback();
        } else {
          engine.scrollEngine.reset();
          engine.startPlayback();
        }
      }
      break;

    case "CMD_JUMP":
      if (
        engine.state.view === "prompter" &&
        engine.state.mode === "popup" &&
        Number.isInteger(msg.index)
      ) {
        engine.goToChunk(msg.index);
      }
      break;

    case "CMD_PUSH_SCRIPT": {
      if (typeof msg.rawScript !== "string" || !msg.rawScript.trim()) return;
      if (msg.rawScript.length > MAX_PUSH_SCRIPT_CHARS) {
        sendToDirector({ type: "SCRIPT_REJECTED", reason: "TOO_LONG" });
        return;
      }

      const nextText = msg.rawScript;
      els.scriptInput.value = nextText;
      storage.saveSessionNow(nextText);
      updateStats();

      if (engine.state.view === "prompter") {
        const wasPlaying = engine.state.isPlaying;
        engine.stopPlayback();
        engine.mountScript(nextText, {
          mode: els.modeSelect.value,
          pacingMode: els.pacingMode.value,
          speedValue: els.speedInput.value,
          preservePosition: true
        });
        if (wasPlaying) engine.startPlayback();
      }
      showToast(els.toastContainer, t("toastRemoteUpdated"));
      broadcastFullState();
      break;
    }

    case "CMD_VISUAL": {
      if (msg.key === "contrast") {
        document.body.classList.toggle("high-contrast");
        els.contrastBtn.classList.toggle("active-state");
      } else if (msg.key === "eyeline") {
        els.eyeline.classList.toggle("hidden");
        els.eyelineBtn.classList.toggle("active-state");
      } else if (msg.key === "mirrorX") {
        els.stageViewport.classList.toggle("mirror-x");
        els.mirrorXBtn.classList.toggle("active-state");
      } else if (msg.key === "mirrorY") {
        els.stageViewport.classList.toggle("mirror-y");
        els.mirrorYBtn.classList.toggle("active-state");
      }
      broadcastFullState();
      break;
    }
  }
}

function evaluateHostAuth(pinInput, sessionId) {
  const now = Date.now();
  if (now < dualState.lockoutUntil) {
    const remainingSec = Math.max(1, Math.ceil((dualState.lockoutUntil - now) / 1000));
    return { ok: false, reason: "LOCKED", remainingSec };
  }

  if (String(pinInput || "").trim() !== dualState.pinCode) {
    dualState.failedPinAttempts += 1;
    const remaining = Math.max(0, MAX_PIN_ATTEMPTS - dualState.failedPinAttempts);
    if (dualState.failedPinAttempts >= MAX_PIN_ATTEMPTS) {
      dualState.lockoutUntil = now + LOCKOUT_DURATION_MS;
      updateUnlockButtonVisibility();
      showToast(els.toastContainer, t("toastPinLockedHost"), true);
      const remainingSec = Math.ceil(LOCKOUT_DURATION_MS / 1000);
      return { ok: false, reason: "LOCKED", remainingSec };
    }
    return { ok: false, reason: "INVALID_PIN", remaining };
  }

  if (
    dualState.lockedDirectorSessionId &&
    sessionId &&
    dualState.lockedDirectorSessionId !== sessionId
  ) {
    return { ok: false, reason: "ROOM_LOCKED" };
  }

  dualState.failedPinAttempts = 0;
  dualState.lockedDirectorSessionId = sessionId || createSessionId();
  updateUnlockButtonVisibility();
  return { ok: true };
}

function destroyHostPeer() {
  if (dualState.activeDirectorConn) {
    try {
      dualState.activeDirectorConn.close();
    } catch {}
    dualState.activeDirectorConn = null;
  }
  if (dualState.hostPeer) {
    try {
      dualState.hostPeer.destroy();
    } catch {}
    dualState.hostPeer = null;
  }
  if (dualState.hostBc) {
    try {
      dualState.hostBc.close();
    } catch {}
    dualState.hostBc = null;
  }
  dualState.lockedDirectorSessionId = null;
  setHostConnectionUi(false);
}

async function initHostPeer() {
  const seq = ++dualState.hostInitSeq;
  destroyHostPeer();

  dualState.roomCode = generateRoomCode();
  dualState.pinCode = generatePinCode();
  dualState.failedPinAttempts = 0;
  dualState.lockoutUntil = 0;
  dualState.lockedDirectorSessionId = null;

  els.hostRoomCode.textContent = dualState.roomCode;
  els.hostPinCode.textContent = dualState.pinCode;
  els.unlockDirectorBtn.classList.add("hidden");
  renderHostQr();

  // 1. 啟用同機雙分頁 BroadcastChannel 同步通道（零伺服器延遲）
  if ("BroadcastChannel" in window) {
    const bc = new BroadcastChannel(`${BC_PREFIX}${dualState.roomCode}`);
    dualState.hostBc = bc;
    bc.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "AUTH") {
        const res = evaluateHostAuth(msg.pin, msg.sessionId);
        if (res.ok) {
          setHostConnectionUi(true);
          bc.postMessage({ type: "AUTH_OK", targetSessionId: msg.sessionId });
          bc.postMessage({
            ...buildFullStatePayload(),
            targetSessionId: msg.sessionId
          });
          showToast(els.toastContainer, t("connConnected"));
        } else {
          bc.postMessage({
            type: "AUTH_ERR",
            reason: res.reason,
            remaining: res.remaining,
            remainingSec: res.remainingSec,
            targetSessionId: msg.sessionId
          });
        }
        return;
      }

      if (
        dualState.lockedDirectorSessionId &&
        msg.sessionId === dualState.lockedDirectorSessionId
      ) {
        if (msg.type === "DIRECTOR_BYE") {
          setHostConnectionUi(false);
          return;
        }
        handleDirectorCommand(msg);
      }
    };
  }

  // 2. 動態解析並啟用跨裝置 PeerJS WebRTC 通道
  const PeerCtor = await resolvePeerCtor();
  if (seq !== dualState.hostInitSeq) return;

  if (!PeerCtor) {
    showToast(els.toastContainer, t("toastHostLocalOnly"));
    return;
  }

  const peer = new PeerCtor(`${PEER_PREFIX}${dualState.roomCode}`);
  dualState.hostPeer = peer;

  peer.on("connection", (conn) => {
    let authenticated = false;

    conn.on("data", (data) => {
      if (!data || typeof data !== "object") return;

      if (!authenticated) {
        if (data.type !== "AUTH") return;

        const res = evaluateHostAuth(data.pin, data.sessionId);
        if (res.ok) {
          authenticated = true;
          if (dualState.activeDirectorConn && dualState.activeDirectorConn !== conn) {
            try {
              dualState.activeDirectorConn.close();
            } catch {}
          }
          dualState.activeDirectorConn = conn;
          setHostConnectionUi(true);
          conn.send({ type: "AUTH_OK" });
          conn.send(buildFullStatePayload());
          showToast(els.toastContainer, t("connConnected"));
        } else {
          conn.send({
            type: "AUTH_ERR",
            reason: res.reason,
            remaining: res.remaining,
            remainingSec: res.remainingSec
          });
          setTimeout(() => conn.close(), 150);
        }
        return;
      }

      handleDirectorCommand(data);
    });

    conn.on("close", () => {
      if (dualState.activeDirectorConn === conn) {
        dualState.activeDirectorConn = null;
        setHostConnectionUi(false);
        showToast(els.toastContainer, t("connDisconnected"), true);
      }
    });
  });

  peer.on("error", (err) => {
    if (err?.type === "unavailable-id") {
      showToast(els.toastContainer, t("toastRoomIdConflict"), true);
      initHostPeer();
    } else {
      showToast(els.toastContainer, `${t("connDisconnected")} (${err?.type || "network"})`, true);
    }
  });
}

function clearArmedJump() {
  if (dualState.armedTimer) {
    clearTimeout(dualState.armedTimer);
    dualState.armedTimer = null;
  }
  dualState.armedIdx = -1;
  els.directorScriptList
    .querySelectorAll(".dir-chunk-item.armed")
    .forEach((el) => el.classList.remove("armed"));
}

function renderDirectorIndexOnly({ currentIndex, isPlaying, total }) {
  if (dualState.lastDirectorState) {
    dualState.lastDirectorState.currentIndex = currentIndex;
    dualState.lastDirectorState.isPlaying = isPlaying;
  }
  const totalCount = total || els.directorScriptList.children.length || 1;
  const safeIdx = Math.max(0, Math.min(currentIndex ?? 0, totalCount - 1));

  els.directorProgress.textContent = `${safeIdx + 1} / ${totalCount}`;
  els.dirToggleBtn.textContent = isPlaying ? t("ctrlPause") : t("ctrlResume");

  if (dualState.lastDirectorActiveIdx === safeIdx) return;
  dualState.lastDirectorActiveIdx = safeIdx;

  const nodes = els.directorScriptList.querySelectorAll(".dir-chunk-item");
  nodes.forEach((node, idx) => {
    node.classList.toggle("active", idx === safeIdx);
    if (idx === safeIdx) {
      node.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
}

function renderDirectorFullState(stateMsg) {
  dualState.lastDirectorState = { ...stateMsg };
  const { items = [], rawScript = "", currentIndex = 0, isPlaying = false, mode = "popup", visualState } = stateMsg;

  const modeLabel = mode === "popup" ? t("metaModePopup") : t("metaModeScroll");
  els.directorMetaBadge.textContent = `${items.length} · ${modeLabel}`;

  if (document.activeElement !== els.directorLiveTextarea) {
    els.directorLiveTextarea.value = rawScript;
  }

  if (visualState) {
    els.dirContrastBtn.classList.toggle("active-state", Boolean(visualState.highContrast));
    els.dirEyelineBtn.classList.toggle("active-state", Boolean(visualState.eyelineHidden));
    els.dirMirrorXBtn.classList.toggle("active-state", Boolean(visualState.mirrorX));
    els.dirMirrorYBtn.classList.toggle("active-state", Boolean(visualState.mirrorY));
  }

  clearArmedJump();
  dualState.lastDirectorActiveIdx = -1;

  const fragment = document.createDocumentFragment();
  items.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "dir-chunk-item";
    div.textContent = `${idx + 1}. ${item.text}`;

    div.addEventListener("click", () => {
      if (dualState.armedIdx === idx) {
        clearArmedJump();
        sendDirectorCommand({ type: "CMD_JUMP", index: idx });
        return;
      }
      clearArmedJump();
      dualState.armedIdx = idx;
      div.classList.add("armed");
      if (Date.now() - dualState.lastArmHintAt > 5000) {
        dualState.lastArmHintAt = Date.now();
        showToast(els.toastContainer, t("toastDoubleClickHint"));
      }
      dualState.armedTimer = setTimeout(() => clearArmedJump(), 2500);
    });

    fragment.appendChild(div);
  });

  els.directorScriptList.replaceChildren(fragment);
  renderDirectorIndexOnly({ currentIndex, isPlaying, total: items.length });
}

function sendDirectorCommand(payload) {
  if (dualState.directorConn?.open) {
    dualState.directorConn.send(payload);
    return;
  }
  if (dualState.directorBc) {
    dualState.directorBc.postMessage({
      ...payload,
      sessionId: dualState.directorSessionId
    });
    return;
  }
  showToast(els.toastContainer, t("toastDirectorConnFail"), true);
}

function clearConnectTimeout() {
  if (dualState.connectTimeoutId !== null) {
    clearTimeout(dualState.connectTimeoutId);
    dualState.connectTimeoutId = null;
  }
}

function destroyDirectorPeer() {
  clearConnectTimeout();
  clearArmedJump();
  if (dualState.directorConn) {
    try {
      dualState.directorConn.close();
    } catch {}
    dualState.directorConn = null;
  }
  if (dualState.directorPeer) {
    try {
      dualState.directorPeer.destroy();
    } catch {}
    dualState.directorPeer = null;
  }
  if (dualState.directorBc) {
    try {
      dualState.directorBc.postMessage({
        type: "DIRECTOR_BYE",
        sessionId: dualState.directorSessionId
      });
      dualState.directorBc.close();
    } catch {}
    dualState.directorBc = null;
  }
}

function handleAuthError(msg) {
  els.connectDirectorBtn.disabled = false;
  setDirectorStatusUi("connDisconnected", false);

  let errText;
  if (msg.reason === "LOCKED") {
    errText = t("toastPinLocked", msg.remainingSec ?? 300);
  } else if (msg.reason === "ROOM_LOCKED") {
    errText = t("toastRoomLocked");
  } else {
    errText = t("toastInvalidPin", msg.remaining ?? 0);
  }
  showToast(els.toastContainer, errText, true);
  destroyDirectorPeer();
}

function handleDirectorInbound(msg) {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "AUTH_OK") {
    clearConnectTimeout();
    els.connectDirectorBtn.disabled = false;
    setDirectorStatusUi("connConnected", true);
    els.editorView.classList.add("hidden");
    els.directorView.classList.remove("hidden");
    return;
  }

  if (msg.type === "AUTH_ERR") {
    handleAuthError(msg);
    return;
  }

  if (msg.type === "SCRIPT_REJECTED" && msg.reason === "TOO_LONG") {
    showToast(els.toastContainer, t("toastScriptTooLong"), true);
    return;
  }

  if (msg.type === "FULL_STATE") {
    renderDirectorFullState(msg);
  } else if (msg.type === "STATE_INDEX") {
    renderDirectorIndexOnly(msg);
  }
}

async function connectDirector() {
  const room = els.joinRoomInput.value.trim().toUpperCase();
  const pin = els.joinPinInput.value.trim();

  if (room.length !== 6 || !/^\d{6}$/.test(pin)) {
    showToast(els.toastContainer, t("toastInvalidRoom"), true);
    return;
  }

  destroyDirectorPeer();
  els.connectDirectorBtn.disabled = true;
  setDirectorStatusUi("connVerifying", false);

  let handshakeSettled = false;

  // 1. 優先嘗試同機雙分頁 BroadcastChannel 握手
  if ("BroadcastChannel" in window) {
    const bc = new BroadcastChannel(`${BC_PREFIX}${room}`);
    dualState.directorBc = bc;
    bc.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || msg.targetSessionId !== dualState.directorSessionId) return;
      if (msg.type === "AUTH_OK" || msg.type === "AUTH_ERR") {
        handshakeSettled = true;
        // 同機已直連成功，關閉多餘的跨裝置 Peer 避免雙重指令
        if (dualState.directorPeer) {
          try {
            dualState.directorPeer.destroy();
          } catch {}
          dualState.directorPeer = null;
          dualState.directorConn = null;
        }
      }
      handleDirectorInbound(msg);
    };
    bc.postMessage({
      type: "AUTH",
      pin,
      sessionId: dualState.directorSessionId
    });
  }

  // 2. 同步檢查並嘗試跨裝置 PeerJS WebRTC 握手
  const PeerCtor = await resolvePeerCtor();
  if (handshakeSettled) return;

  if (!PeerCtor) {
    // 若無 PeerJS SDK，給予同機分頁 600ms 響應窗口，無回應則提示缺少 SDK
    dualState.connectTimeoutId = setTimeout(() => {
      if (handshakeSettled) return;
      els.connectDirectorBtn.disabled = false;
      setDirectorStatusUi("connDisconnected", false);
      showToast(els.toastContainer, t("toastSdkMissing"), true);
      destroyDirectorPeer();
    }, 600);
    return;
  }

  dualState.connectTimeoutId = setTimeout(() => {
    if (handshakeSettled) return;
    els.connectDirectorBtn.disabled = false;
    setDirectorStatusUi("connDisconnected", false);
    showToast(els.toastContainer, t("toastConnTimeout"), true);
    destroyDirectorPeer();
  }, CONNECT_TIMEOUT_MS);

  const peer = new PeerCtor();
  dualState.directorPeer = peer;

  peer.on("open", () => {
    if (handshakeSettled) return;
    const conn = peer.connect(`${PEER_PREFIX}${room}`, { reliable: true });
    dualState.directorConn = conn;

    conn.on("open", () => {
      conn.send({
        type: "AUTH",
        pin,
        sessionId: dualState.directorSessionId
      });
    });

    conn.on("data", (msg) => {
      if (msg?.type === "AUTH_OK" || msg?.type === "AUTH_ERR") {
        handshakeSettled = true;
        if (dualState.directorBc) {
          try {
            dualState.directorBc.close();
          } catch {}
          dualState.directorBc = null;
        }
      }
      handleDirectorInbound(msg);
    });

    conn.on("close", () => {
      if (!handshakeSettled) return;
      els.connectDirectorBtn.disabled = false;
      setDirectorStatusUi("connDisconnected", false);
      showToast(els.toastContainer, t("connDisconnected"), true);
    });
  });

  peer.on("error", () => {
    if (handshakeSettled) return;
    clearConnectTimeout();
    els.connectDirectorBtn.disabled = false;
    setDirectorStatusUi("connDisconnected", false);
    showToast(els.toastContainer, t("toastDirectorConnFail"), true);
    destroyDirectorPeer();
  });
}

function selectRole(role) {
  dualState.role = role;
  els.roleTabs.forEach((tab) => {
    const active = tab.dataset.role === role;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  if (role === "prompter") {
    els.prompterPairBox.classList.remove("hidden");
    els.directorPairBox.classList.add("hidden");
    els.scriptInput.classList.remove("hidden");
    els.storageBar.classList.remove("hidden");
    els.editorSettingsGrid.classList.remove("hidden");
    els.startBtn.classList.remove("hidden");
    if (!dualState.hostPeer && !dualState.hostBc) initHostPeer();
  } else {
    // 註 1：導播後台的 dir-contrast-btn 預設隨 body.high-contrast 亮燈，
    // 連線後會由 renderDirectorFullState() 依據提詞端實際 visualState 動態同步。
    // 註 2：導播端隱藏 storageBar 與 scriptInput；storage 實例仍在背景監聽 scriptInput，
    // 若未來要讓導播端也能編輯稿件，需同步調整 storage 的綁定範圍。
    els.prompterPairBox.classList.add("hidden");
    els.directorPairBox.classList.remove("hidden");
    els.scriptInput.classList.add("hidden");
    els.storageBar.classList.add("hidden");
    els.editorSettingsGrid.classList.add("hidden");
    els.startBtn.classList.add("hidden");
  }
}

function updateStats() {
  const sentences = splitSentences(els.scriptInput.value);
  const durations = sentences.map((s) =>
    calculateSentenceDurationMs(s, els.pacingMode.value, els.speedInput.value)
  );
  const totalSec = Math.round(calculateTotalDurationMs(durations) / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const timeStr = mins > 0 ? t("timeMinSec", mins, secs) : t("timeSec", secs);
  els.statsBadge.textContent = t("statsFmt", sentences.length, timeStr);
}

const storage = initScriptStorage({
  textareaEl: els.scriptInput,
  statusEl: els.storageStatus,
  t,
  onUpdate: updateStats
});

els.roleTabs.forEach((tab) => {
  tab.addEventListener("click", () => selectRole(tab.dataset.role));
});

els.copyLinkBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(buildPairUrl());
    showToast(els.toastContainer, t("toastLinkCopied"));
  } catch {
    showToast(els.toastContainer, t("toastQrTooLong"), true);
  }
});

els.resetPairBtn.addEventListener("click", () => {
  initHostPeer();
  showToast(els.toastContainer, t("toastPairReset"));
});

els.unlockDirectorBtn.addEventListener("click", () => {
  dualState.failedPinAttempts = 0;
  dualState.lockoutUntil = 0;
  dualState.lockedDirectorSessionId = null;
  updateUnlockButtonVisibility();
  showToast(els.toastContainer, t("toastDirectorUnlocked"));
});

els.joinRoomInput.addEventListener("input", () => {
  els.joinRoomInput.value = els.joinRoomInput.value.toUpperCase();
});

[els.joinRoomInput, els.joinPinInput].forEach((inputEl) => {
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      connectDirector();
    }
  });
});

els.connectDirectorBtn.addEventListener("click", connectDirector);

els.directorExitBtn.addEventListener("click", () => {
  destroyDirectorPeer();
  els.directorView.classList.add("hidden");
  els.editorView.classList.remove("hidden");
});

els.directorPushScriptBtn.addEventListener("click", () => {
  const nextScript = els.directorLiveTextarea.value.trim();
  if (!nextScript) {
    showToast(els.toastContainer, t("toastEmptyScript"), true);
    return;
  }
  if (els.directorLiveTextarea.value.length > MAX_PUSH_SCRIPT_CHARS) {
    showToast(els.toastContainer, t("toastScriptTooLong"), true);
    return;
  }
  sendDirectorCommand({ type: "CMD_PUSH_SCRIPT", rawScript: els.directorLiveTextarea.value });
  showToast(els.toastContainer, t("toastScriptPushed"));
});

els.dirPrevBtn.addEventListener("click", () => sendDirectorCommand({ type: "CMD_PREV" }));
els.dirNextBtn.addEventListener("click", () => sendDirectorCommand({ type: "CMD_NEXT" }));
els.dirToggleBtn.addEventListener("click", () => sendDirectorCommand({ type: "CMD_TOGGLE" }));
els.dirRestartBtn.addEventListener("click", () => sendDirectorCommand({ type: "CMD_RESTART" }));
els.dirEyelineBtn.addEventListener("click", () => sendDirectorCommand({ type: "CMD_VISUAL", key: "eyeline" }));
els.dirContrastBtn.addEventListener("click", () => sendDirectorCommand({ type: "CMD_VISUAL", key: "contrast" }));
els.dirMirrorXBtn.addEventListener("click", () => sendDirectorCommand({ type: "CMD_VISUAL", key: "mirrorX" }));
els.dirMirrorYBtn.addEventListener("click", () => sendDirectorCommand({ type: "CMD_VISUAL", key: "mirrorY" }));

els.saveLocalBtn.addEventListener("click", () => {
  storage.saveLocal();
  showToast(els.toastContainer, t("toastSavedLocal"));
});

els.clearStorageBtn.addEventListener("click", () => {
  storage.clearAll();
  showToast(els.toastContainer, t("toastCleared"));
});

els.pacingMode.addEventListener("change", () => {
  if (els.pacingMode.value === "dynamic") {
    els.speedLabel.setAttribute("data-i18n", "labelSpeedCpm");
    els.speedLabel.textContent = t("labelSpeedCpm");
    els.speedInput.value = 210;
    els.speedInput.min = 60;
    els.speedInput.max = 500;
    els.speedInput.step = 10;
  } else {
    els.speedLabel.setAttribute("data-i18n", "labelSpeedFixed");
    els.speedLabel.textContent = t("labelSpeedFixed");
    els.speedInput.value = 3.5;
    els.speedInput.min = 0.5;
    els.speedInput.max = 60;
    els.speedInput.step = 0.5;
  }
  updateStats();
});

els.speedInput.addEventListener("input", updateStats);

// 僅在使用者手動拖動滑桿時覆寫 CSS 變數，初始化時保留 CSS 媒體查詢斷點
els.fontSizeInput.addEventListener("input", () => {
  els.fsVal.textContent = `${els.fontSizeInput.value}px`;
  document.documentElement.style.setProperty("--font-size", `${els.fontSizeInput.value}px`);
});

els.lineHeightInput.addEventListener("input", () => {
  els.lhVal.textContent = els.lineHeightInput.value;
  document.documentElement.style.setProperty("--line-height", els.lineHeightInput.value);
});

els.langBtn.addEventListener("click", () => {
  toggleLang();
  updateStats();
  setHostConnectionUi(dualState.hostConnected);
  setDirectorStatusUi(
    dualState.directorStatusKey,
    els.directorConnStatus.classList.contains("connected")
  );
  if (engine.state.view === "prompter") {
    els.toggleBtn.textContent = engine.state.isPlaying ? t("ctrlPause") : t("ctrlResume");
  }
  if (dualState.lastDirectorState) {
    const { items = [], mode = "popup", isPlaying = false } = dualState.lastDirectorState;
    const modeLabel = mode === "popup" ? t("metaModePopup") : t("metaModeScroll");
    els.directorMetaBadge.textContent = `${items.length} · ${modeLabel}`;
    els.dirToggleBtn.textContent = isPlaying ? t("ctrlPause") : t("ctrlResume");
  }
});

els.stageViewport.addEventListener("click", () => {
  if (engine.state.view === "prompter" && engine.state.mode === "popup") {
    engine.goToChunk(engine.state.currentIndex + 1);
  }
});

els.startBtn.addEventListener("click", async () => {
  const rawText = els.scriptInput.value.trim();
  if (!rawText) {
    showToast(els.toastContainer, t("toastEmptyScript"), true);
    return;
  }

  engine.state.view = "prompter";
  engine.enableUnloadGuard();
  els.editorView.classList.add("hidden");
  els.prompterView.classList.remove("hidden");

  await engine.acquireWakeLock();
  engine.mountScript(rawText, {
    mode: els.modeSelect.value,
    pacingMode: els.pacingMode.value,
    speedValue: els.speedInput.value,
    preservePosition: false
  });
  engine.startPlayback();
  broadcastFullState();
});

els.micBtn.addEventListener("click", () => {
  if (engine.state.micEnabled) {
    engine.vad.stop();
    engine.state.micEnabled = false;
    engine.state.isSpeaking = true;
    els.micBtn.classList.remove("active-state");
    els.micBarWrap.classList.add("hidden");
    engine.syncSchedule();
    return;
  }
  els.micModal.classList.remove("hidden");
  els.micConfirmBtn.focus();
});

els.micCancelBtn.addEventListener("click", () => {
  els.micModal.classList.add("hidden");
  els.micBtn.focus();
});

els.micConfirmBtn.addEventListener("click", async () => {
  els.micModal.classList.add("hidden");
  els.micBtn.focus();
  const wasPlaying = engine.state.isPlaying;
  engine.stopPlayback();

  try {
    await engine.vad.start();
    engine.state.micEnabled = true;
    engine.state.isSpeaking = true;
    els.micBtn.classList.add("active-state");
    els.micBarWrap.classList.remove("hidden");
    els.micStatusText.textContent = t("micListening");
    if (wasPlaying) engine.startPlayback();
  } catch (err) {
    if (wasPlaying) engine.startPlayback();
    if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
      showToast(els.toastContainer, t("errMicDenied"), true);
    } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
      showToast(els.toastContainer, t("errMicNotFound"), true);
    } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
      showToast(els.toastContainer, t("errMicBusy"), true);
    } else {
      showToast(els.toastContainer, t("errMicGeneric"), true);
    }
  }
});

els.toggleBtn.addEventListener("click", () =>
  engine.state.isPlaying ? engine.stopPlayback() : engine.startPlayback()
);
els.prevBtn.addEventListener("click", () => engine.goToChunk(engine.state.currentIndex - 1));
els.nextBtn.addEventListener("click", () => engine.goToChunk(engine.state.currentIndex + 1));

els.contrastBtn.addEventListener("click", () => {
  document.body.classList.toggle("high-contrast");
  els.contrastBtn.classList.toggle("active-state");
  broadcastFullState();
});
els.eyelineBtn.addEventListener("click", () => {
  els.eyeline.classList.toggle("hidden");
  els.eyelineBtn.classList.toggle("active-state");
  broadcastFullState();
});
els.mirrorXBtn.addEventListener("click", () => {
  els.stageViewport.classList.toggle("mirror-x");
  els.mirrorXBtn.classList.toggle("active-state");
  broadcastFullState();
});
els.mirrorYBtn.addEventListener("click", () => {
  els.stageViewport.classList.toggle("mirror-y");
  els.mirrorYBtn.classList.toggle("active-state");
  broadcastFullState();
});

els.restartBtn.addEventListener("click", () => {
  if (engine.state.mode === "popup") {
    engine.goToChunk(0);
    engine.startPlayback();
  } else {
    engine.scrollEngine.reset();
    engine.startPlayback();
  }
});

els.backBtn.addEventListener("click", () => {
  engine.disableUnloadGuard();
  engine.stopPlayback();
  if (engine.state.micEnabled) {
    engine.vad.stop();
    engine.state.micEnabled = false;
    els.micBtn.classList.remove("active-state");
    els.micBarWrap.classList.add("hidden");
  }
  engine.releaseWakeLock();
  engine.state.view = "editor";
  els.prompterView.classList.add("hidden");
  els.editorView.classList.remove("hidden");
  broadcastFullState();
});

document.addEventListener("keydown", (e) => {
  if (!els.micModal.classList.contains("hidden")) {
    if (e.key === "Escape") {
      e.preventDefault();
      els.micModal.classList.add("hidden");
      els.micBtn.focus();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const focusables = [els.micCancelBtn, els.micConfirmBtn];
      const idx = focusables.indexOf(document.activeElement);
      const nextIdx = e.shiftKey
        ? (idx + focusables.length - 1) % focusables.length
        : (idx + 1) % focusables.length;
      focusables[nextIdx].focus();
      return;
    }
    return;
  }

  if (engine.state.view !== "prompter") return;

  if (e.code === "Space") {
    e.preventDefault();
    if (document.activeElement instanceof HTMLButtonElement) {
      document.activeElement.blur();
    }
    engine.state.isPlaying ? engine.stopPlayback() : engine.startPlayback();
  } else if (e.code === "ArrowDown" || e.code === "ArrowRight" || e.code === "PageDown") {
    e.preventDefault();
    if (engine.state.mode === "popup") engine.goToChunk(engine.state.currentIndex + 1);
  } else if (e.code === "ArrowUp" || e.code === "ArrowLeft" || e.code === "PageUp") {
    e.preventDefault();
    if (engine.state.mode === "popup") engine.goToChunk(engine.state.currentIndex - 1);
  } else if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
});

window.addEventListener("pagehide", () => {
  destroyDirectorPeer();
  destroyHostPeer();
});

applyTranslations();
updateStats();
initEasterEgg();

const params = new URLSearchParams(window.location.search);
const presetRoom = (params.get("room") || "").trim().toUpperCase();
const presetPin = (params.get("pin") || "").trim();

if (presetRoom || presetPin) {
  els.joinRoomInput.value = presetRoom.slice(0, 6);
  els.joinPinInput.value = presetPin.slice(0, 6);
  selectRole("director");
} else {
  selectRole("prompter");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
