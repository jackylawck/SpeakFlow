const LANG_KEY = "tp_ui_lang";

const DICT = {
  zh: {
    appTitle: "🎙️ 順住講 SpeakFlow",
    appTitleDual: "🎙️ 順住講 SpeakFlow · 導播版",
    linkToDual: "🎛️ 切換至雙機導播版",
    linkToSolo: "📱 返回單機極簡版",
    rolePrompter: "📺 雙機：提詞螢幕端",
    roleDirector: "🎛️ 雙機：後台控制台",
    roomCodeLabel: "房號：",
    pinCodeLabel: "PIN：",
    connWaiting: "等待後台驗證連線",
    connConnected: "🟢 後台已驗證連線",
    btnCopyLink: "🔗 複製含 PIN 連線網址",
    btnResetPair: "🔄 重置房號 / PIN",
    btnUnlockDirector: "🔓 解除導播鎖定",
    enterRoomLabel: "房號：",
    enterPinLabel: "PIN：",
    btnConnectDirector: "驗證並進入後台",
    directorTitle: "🎛️ 順住講 · 導播後台控制台",
    btnExitDirector: "離開後台",
    directorMonitorLabel: "📺 主播端進度監看（雙擊任意句可安全跳段）",
    directorLiveEditLabel: "✍️ 突發插播 / 即時改稿推送（自動錨定主播當前位置）",
    directorLivePlaceholder: "在此修改新聞稿，點擊下方按鈕即可即時同步至主播提詞器...",
    btnPushScript: "🚀 立即推送更新至提詞器",
    ctrlToggleRemote: "⏯ 播放 / 暫停",
    scriptPlaceholder: "貼上中文、英文或中英混排新聞稿...\n\n系統內建 Unicode UAX #29 語意斷句引擎，不會誤切 Dr. Smith、3.14 或省略號……",
    storageSessionHint: "🔒 目前僅暫存於分頁記憶體（關閉分頁即自動清除）",
    storageLocalSaved: "⚠️ 已儲存於本機瀏覽器（共用裝置播畢請務必清除）",
    storageLocalRestored: "📂 已從本機草稿恢復（目前在分頁記憶體中編輯）",
    btnSaveLocal: "💾 儲存至本機",
    btnClearStorage: "🗑️ 清除本機稿件",
    labelMode: "播報模式",
    modePopup: "逐句動態彈出 (推薦)",
    modeScroll: "GPU 平滑滾動",
    labelPacing: "計時策略",
    pacingDynamic: "依字數自動配時",
    pacingFixed: "每句固定秒數",
    labelSpeedCpm: "語速 (字/分鐘)",
    labelSpeedFixed: "每句固定秒數",
    labelFontSize: "字體大小",
    labelLineHeight: "行距倍率",
    btnStart: "進入全螢幕讀稿",
    ctrlBack: "✏️ 改稿",
    ctrlPrev: "⬆️ 上一句",
    ctrlPause: "⏸ 暫停",
    ctrlResume: "▶️ 繼續",
    ctrlNextPpt: "⬇️ 下一句 (PPT)",
    ctrlMic: "🎙️ 音壓跟讀",
    ctrlContrast: "🌗 高對比",
    ctrlEyeline: "📏 基準線",
    ctrlMirrorX: "↔️ 水平鏡像",
    ctrlMirrorY: "↕️ 垂直翻轉",
    ctrlRestart: "🔄 重來",
    micListening: "🎙️ 聆聽中",
    micSpeaking: "🟢 說話中 (推進)",
    micPaused: "⏸ 靜音待命",
    micModalTitle: "🎙️ 麥克風權限說明（建議獨處靜音環境使用）",
    micModalBody: "音壓跟讀功能會使用麥克風偵測您的說話音量，以實現「開口自動推進、停頓自動暫停」。所有音訊僅在您的裝置本機記憶體中即時分析，絕不錄製、不儲存、亦不上傳至任何伺服器。",
    btnCancel: "取消",
    btnAgreeEnable: "同意並啟用",
    toastEmptyScript: "請先輸入新聞稿內容。",
    toastSavedLocal: "已將草稿儲存至本機。若使用共用電腦或 iPad，結束後請記得清除。",
    toastCleared: "已徹底清除分頁與本機儲存的稿件。",
    toastGpuScroll: "GPU 平滑滾動",
    toastLinkCopied: "已複製含 PIN 驗證碼的後台連線網址。",
    toastPairReset: "已產生全新房號與 6 位數 PIN 驗證碼。",
    toastDirectorUnlocked: "已解除導播 Session 鎖定，現在可由新裝置驗證連入。",
    toastRoomLocked: "連線遭拒：此提詞端已鎖定給另一位導播（僅允許原導播斷線重連）。",
    toastInvalidRoom: "請輸入 6 位房號與 6 位數字 PIN 驗證碼。",
    toastInvalidPin: (rem) => `PIN 驗證碼錯誤（剩餘 ${rem} 次嘗試機會，連續失敗將鎖定 5 分鐘）。`,
    toastPinLocked: (sec) => `驗證失敗次數過多，系統已暫時鎖定（請於 ${sec} 秒後再試，或請主播重置 PIN）。`,
    toastPinLockedHost: "⚠️ 連續 5 次錯誤 PIN 嘗試，已鎖定 5 分鐘。若為誤觸，請點擊「🔄 重置房號 / PIN」立即恢復。",
    toastRoomIdConflict: "房號發生衝突，請點擊「🔄 重置房號 / PIN」產生新房號。",
    toastQrTooLong: "目前網址過長超出 QR Code 容量，請直接使用「複製含 PIN 連線網址」按鈕。",
    toastConnTimeout: "連線超時（10s）：可能處於企業對稱 NAT 或防火牆環境，建議改用同機雙分頁模式。",
    toastSdkMissing: "未偵測到跨裝置 SDK (vendor/peerjs.esm.js) 且同機無對應分頁，請確認部署檔案。",
    toastDirectorConnFail: "無法連線至提詞螢幕端，請確認房號與 PIN 正確。",
    toastHostLocalOnly: "未偵測到跨裝置 SDK (vendor/peerjs.esm.js)，目前僅啟用同機雙分頁同步。",
    toastSignalReconnecting: (attempt, sec) => `信令網路波動，正在進行第 ${attempt} 次自動重連 (${sec}s)...`,
    toastScriptPushed: "已將最新新聞稿即時推送至提詞器！",
    toastScriptTooLong: "推送失敗：新聞稿超過 50,000 字上限。",
    toastRemoteUpdated: "📡 收到後台即時更新的新聞稿（已自動錨定當前句）",
    toastDoubleClickHint: "再點一下確認跳轉至該句",
    unloadWarning: "播報或導播連線進行中，離開或重新整理頁面將中斷提詞與連線！",
    errMicDenied: "麥克風權限遭拒絕：請在瀏覽器網址列或系統設定中允許麥克風存取。",
    errMicNotFound: "找不到可用的麥克風裝置，請確認收音設備已連接。",
    errMicBusy: "麥克風正被其他應用程式佔用，無法啟動音壓跟讀。",
    errMicGeneric: "無法啟動麥克風，請確認使用 HTTPS 連線（GitHub Pages 預設支援）。",
    statsFmt: (count, timeStr) => `${count} 句 · 預計 ${timeStr}`,
    timeMinSec: (m, s) => `${m} 分 ${s} 秒`,
    timeSec: (s) => `${s} 秒`
  },
  en: {
    appTitle: "🎙️ SpeakFlow",
    appTitleDual: "🎙️ SpeakFlow · Dual Console",
    linkToDual: "🎛️ Dual-Device Mode",
    linkToSolo: "📱 Single-Device Mode",
    rolePrompter: "📺 Dual: Prompter Screen",
    roleDirector: "🎛️ Dual: Director Console",
    roomCodeLabel: "Room:",
    pinCodeLabel: "PIN:",
    connWaiting: "Waiting for PIN Handshake",
    connConnected: "🟢 Director Authenticated",
    btnCopyLink: "🔗 Copy Link with PIN",
    btnResetPair: "🔄 Reset Room / PIN",
    btnUnlockDirector: "🔓 Unlock Director",
    enterRoomLabel: "Room:",
    enterPinLabel: "PIN:",
    btnConnectDirector: "Verify & Connect",
    directorTitle: "🎛️ SpeakFlow · Director Console",
    btnExitDirector: "Exit Console",
    directorMonitorLabel: "📺 Live Anchor Monitor (Double-click any sentence to jump)",
    directorLiveEditLabel: "✍️ Live Breaking Script Push (Auto-anchors anchor's position)",
    directorLivePlaceholder: "Edit script here and push live updates directly to the anchor's prompter...",
    btnPushScript: "🚀 Push Live Script Update",
    ctrlToggleRemote: "⏯ Play / Pause",
    scriptPlaceholder: "Paste your Chinese, English, or bilingual news script here...\n\nPowered by Unicode UAX #29 segmentation: Dr. Smith, 3.14, and ellipses stay intact.",
    storageSessionHint: "🔒 Tab-only memory (auto-wiped when tab closes)",
    storageLocalSaved: "⚠️ Saved in local browser storage (clear after use on shared devices)",
    storageLocalRestored: "📂 Restored from local backup (editing in tab memory)",
    btnSaveLocal: "💾 Save Draft Locally",
    btnClearStorage: "🗑️ Wipe Local Script",
    labelMode: "Display Mode",
    modePopup: "Sentence-by-Sentence (Recommended)",
    modeScroll: "GPU Smooth Scroll",
    labelPacing: "Pacing Strategy",
    pacingDynamic: "Dynamic Word-Count Pacing",
    pacingFixed: "Fixed Seconds / Sentence",
    labelSpeedCpm: "Speed (Words/Chars per min)",
    labelSpeedFixed: "Seconds per Sentence",
    labelFontSize: "Font Size",
    labelLineHeight: "Line Height",
    btnStart: "Start Teleprompter",
    ctrlBack: "✏️ Edit",
    ctrlPrev: "⬆️ Prev",
    ctrlPause: "⏸ Pause",
    ctrlResume: "▶️ Resume",
    ctrlNextPpt: "⬇️ Next (PPT)",
    ctrlMic: "🎙️ Voice Gate",
    ctrlContrast: "🌗 High Contrast",
    ctrlEyeline: "📏 Eyeline",
    ctrlMirrorX: "↔️ Mirror X",
    ctrlMirrorY: "↕️ Flip Y",
    ctrlRestart: "🔄 Restart",
    micListening: "🎙️ Listening",
    micSpeaking: "🟢 Speaking (Advancing)",
    micPaused: "⏸ Silent (Paused)",
    micModalTitle: "🎙️ Microphone Disclosure (Best for Quiet Solo Rooms)",
    micModalBody: "Voice Gate uses your microphone solely to measure real-time volume levels so the script advances when you speak and pauses when you stop. Audio is processed strictly in local memory—never recorded, stored, or transmitted.",
    btnCancel: "Cancel",
    btnAgreeEnable: "Agree & Enable",
    toastEmptyScript: "Please enter your script first.",
    toastSavedLocal: "Draft saved locally. Remember to wipe it on shared devices.",
    toastCleared: "All session and local script data have been wiped.",
    toastGpuScroll: "GPU Smooth Scroll",
    toastLinkCopied: "Director link with PIN copied!",
    toastPairReset: "Generated a fresh Room Code and 6-digit PIN.",
    toastDirectorUnlocked: "Director session lock cleared. A new console may now connect.",
    toastRoomLocked: "Connection rejected: Prompter is locked to another active Director session.",
    toastInvalidRoom: "Please enter a 6-character Room Code and 6-digit PIN.",
    toastInvalidPin: (rem) => `Invalid PIN (${rem} attempts remaining before 5-minute lockout).`,
    toastPinLocked: (sec) => `Too many failed PIN attempts. Locked for ${sec}s (or ask Anchor to reset PIN).`,
    toastPinLockedHost: "⚠️ 5 failed PIN attempts triggered a 5-min lockout. Click '🔄 Reset Room / PIN' to recover immediately.",
    toastRoomIdConflict: "Room ID collision detected. Click '🔄 Reset Room / PIN' to generate a new room.",
    toastQrTooLong: "URL exceeds QR capacity; please use the 'Copy Link with PIN' button instead.",
    toastConnTimeout: "Connection timed out (10s): Likely symmetric NAT or firewall. Use same-device dual tabs instead.",
    toastSdkMissing: "Cross-device SDK (vendor/peerjs.esm.js) not found and no same-device host detected.",
    toastDirectorConnFail: "Unable to connect to Prompter screen. Verify Room Code and PIN.",
    toastHostLocalOnly: "Cross-device SDK (vendor/peerjs.esm.js) not found; running in same-device BroadcastChannel mode.",
    toastSignalReconnecting: (attempt, sec) => `Signaling interrupted. Reconnecting (attempt ${attempt} in ${sec}s)...`,
    toastScriptPushed: "Live script pushed to Prompter!",
    toastScriptTooLong: "Rejected: Script exceeds 50,000 character limit.",
    toastRemoteUpdated: "📡 Script updated live by Director (position anchored)",
    toastDoubleClickHint: "Click again or double-click to jump to this sentence",
    unloadWarning: "SpeakFlow session is active. Leaving or reloading will interrupt playback and connection!",
    errMicDenied: "Microphone access denied. Please allow permission in browser settings.",
    errMicNotFound: "No microphone hardware detected on this device.",
    errMicBusy: "Microphone is currently in use by another application.",
    errMicGeneric: "Unable to access microphone. Ensure you are running over HTTPS.",
    statsFmt: (count, timeStr) => `${count} sentences · Est. ${timeStr}`,
    timeMinSec: (m, s) => `${m}m ${s}s`,
    timeSec: (s) => `${s}s`
  }
};

function readInitialLang() {
  try {
    return localStorage.getItem(LANG_KEY) || "zh";
  } catch {
    return "zh";
  }
}

let currentLang = readInitialLang();

export function t(key, ...args) {
  const entry = DICT[currentLang]?.[key] ?? DICT.zh?.[key];
  if (entry === undefined) return key;
  return typeof entry === "function" ? entry(...args) : entry;
}

export function applyTranslations() {
  document.documentElement.lang = currentLang === "zh" ? "zh-Hant" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = t(key);
    if (val !== undefined) el.textContent = val;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const val = t(key);
    if (val !== undefined) el.setAttribute("placeholder", val);
  });
}

export function toggleLang() {
  currentLang = currentLang === "zh" ? "en" : "zh";
  try {
    localStorage.setItem(LANG_KEY, currentLang);
  } catch {}
  applyTranslations();
  return currentLang;
}
