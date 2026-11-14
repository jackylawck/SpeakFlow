# 🎙️ 順住講 SpeakFlow

**字順著人的節奏走 · Words Move at the Rhythm of Human Speech**

[![Offline PWA](https://img.shields.io/badge/PWA-100%25_Offline-10b981.svg)](#)
[![Zero Backend](https://img.shields.io/badge/Architecture-Zero_Backend-3b82f6.svg)](#)
[![Strict CSP](https://img.shields.io/badge/Security-Strict_CSP_%26_ZDR-facc15.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-94a3b8.svg)](#)

* **單機極簡版 (Solo Teleprompter)**：[https://jackylawck.github.io/SpeakFlow/](https://jackylawck.github.io/SpeakFlow/)
* **雙機導播版 (Dual-Device Console)**：[https://jackylawck.github.io/SpeakFlow/dual.html](https://jackylawck.github.io/SpeakFlow/dual.html)

[繁體中文](#繁體中文說明) | [English](#english-documentation)

---

## 繁體中文說明

### 專案願景

**順住講 SpeakFlow** 是一款專為獨立記者、自媒體創作者、Podcast 主持與直播團隊打造的**零後端雙語新聞提詞器（Teleprompter PWA）**。

沒有大台的攝影棚與導播團隊，也能擁有一流新聞台的播報節奏——告別手舉紙牌大字報，無需註冊帳號、無需安裝 App、零雲端伺服器追蹤，打開瀏覽器即可在 iPad、手機或筆電上全螢幕順暢讀稿。

---

### 核心工程與播報特性

1. **Unicode UAX #29 語意斷句引擎 (`shared/segmenter.js`)**
   * 基於瀏覽器原生 `Intl.Segmenter` 語意邊界分析，精準識別中英混排句界。
   * 絕不會把 `Dr. Smith`、`3.14%`、`v2.1.1` 或省略號 `……` 誤切成碎片。
2. **新聞播報級動態配時模型 (`shared/pacing.js`)**
   * **依字數自動配時**：支援中文（含粵語及中日韓擴展 B–F 區生僻字）與英文連字／小數詞彙加權計算。
   * **自然換氣停頓**：除句末基礎停頓（`0.55s`）外，自動為逗號、頓號、分號配置 `0.15s` 微停頓（雙連破折號 `——` 計為 `0.30s`），讓長新聞句推進更貼近真人語氣。
   * **固定秒數模式**：支援切換為每句固定停留秒數，適合短影音節奏卡點。
3. **新聞台人體工學三層視覺流 (`styles.css` & `shared/prompter-core.js`)**
   * **連續文本流與預讀分層**：已讀句淡化（`0.22` 透明度）、即將讀到的下一句保持預讀可見（`0.42` 透明度），當前要讀的句子全亮並放大 `1.38 倍` 參與排版流，杜絕水平裁切與兩行重疊。
   * **30% 黃金視線基準線**：當前句頂部邊緣精準對齊視口上方 `30%` 基準線（配合強制同步 Reflow 消除定位漂移），讓主播視線微幅俯視鏡頭附近，避免眼神左右大幅飄移。
   * **專業攝影棚適配**：支援水平鏡像（分光鏡提詞架專用）、垂直翻轉、高對比純黑模式，以及直式平板／手機自動響應式斷點。
4. **PPT 簡報器搶拍 ＋ 本地音壓跟讀 (`shared/vad.js`)**
   * **隨時手動搶拍**：支援簡報器（Presenter Clicker）、鍵盤方向鍵、空白鍵或觸控點擊即時推進／回退，並可點擊已讀句暫時高亮回看 2 秒。
   * **純本地音壓門控（VAD）**：透過 Web Audio API 即時分析麥克風音量，「開口自動推進、停頓自動暫停」。音訊僅在裝置記憶體即時運算，**絕不錄音、不儲存、不上傳**。
5. **雙機導播後台控制台 (`dual.html` & `app-dual.js`)**
   * **點對點加密配對**：提詞螢幕端自動產生 6 位房號、6 位數字 PIN 碼與 QR Code；導播手機掃碼即可秒連（連續 5 次 PIN 錯誤自動鎖定 5 分鐘防暴力破解）。
   * **鏡頭防穿幫設計**：主播進入全螢幕讀稿後，畫面僅低調顯示連線狀態，自動隱藏房號與 PIN，防止直播鏡頭拍到螢幕邊緣造成洩密。
   * **雙擊防誤觸跳段 ＆ 突發改稿自動錨定**：導播端需雙擊句子才會遠端跳段；推送突發改稿時，提詞器會自動比對字元相似度（`findClosestSentence`），無縫錨定主播當前正在讀的位置。
6. **隱私優先與零資料留存架構 (Zero-Data-Retention)**
   * 稿件預設僅存於分頁記憶體（`sessionStorage`），關閉分頁即自動銷毀；另提供手動儲存至本機（`localStorage`）與一鍵徹底清除功能。
   * 單機版執行最嚴格內容安全策略（`connect-src 'self'`、`script-src 'self'`、`style-src 'self'`），實現真正的 100% 離線可用。

---

### 雙機導播配對流程

1. **同一空間（攝影棚／直播間）**：主播在 iPad 或筆電開啟 `dual.html`，導播用手機相機直接掃描畫面上的 **QR Code**，自動帶入房號與 PIN 後點擊「驗證並進入後台」。
2. **異地遠端連線（控制室／遠距協作）**：若導播不在同一房間無法掃碼，主播可點擊「🔗 複製含 PIN 連線網址」傳送給導播，或直接語音念出畫面上的 **6 位房號 ＋ 6 位數字 PIN** 供導播輸入連線。

---

### 快捷鍵一覽表

| 按鍵 / 操作 | 播報模式功能 |
| :--- | :--- |
| `Space` | 播放 / 暫停自動推進 |
| `↓` / `→` / `PageDown` | 下一句（相容簡報翻頁筆） |
| `↑` / `←` / `PageUp` | 上一句（相容簡報翻頁筆） |
| `F` | 切換全螢幕顯示 |
| `Esc` | 關閉麥克風權限說明視窗 |
| 點擊已讀暗字 | 暫時高亮回看 2 秒（再次點擊則跳轉回該句） |
| 導播端雙擊句子 | 兩段式確認安全跳段（防誤觸） |

---

### 專案目錄結構

```text
SpeakFlow/
├── index.html                 # 單機極簡版入口（最嚴格 CSP：connect-src 'self'）
├── dual.html                  # 雙機導播版入口（支援 WebRTC PeerJS 雙向同步）
├── styles.css                 # 全局樣式表（三層視覺流、響應式斷點與無障礙動畫）
├── app-solo.js                # 單機版 UI 與事件控制器
├── app-dual.js                # 雙機版角色切換、PIN 握手與導播控制台邏輯
├── sw.js                      # Service Worker 離線快取與版本更新管理
├── manifest-solo.json         # 單機版 PWA Manifest
├── manifest-dual.json         # 雙機版 PWA Manifest
├── shared/
│   ├── prompter-core.js       # 核心狀態機、強制同步 Reflow 定位與錨定引擎
│   ├── segmenter.js           # Unicode UAX #29 中英混排語意斷句器
│   ├── pacing.js              # 動態字數與標點微停頓配時演算法
│   ├── vad.js                 # Web Audio API 本地音壓跟讀偵測器
│   ├── scroll-engine.js       # 60fps GPU 平滑滾動引擎
│   ├── storage.js             # 分頁記憶體隔離與本機草稿管理
│   ├── i18n.js                # 繁體中文（香港）與英文雙語字典
│   └── easter-egg.js          # DevTools 創作者致敬彩蛋與資源回收器
├── dual/
│   └── qr-svg.js              # 零外部依賴本地向量 QR Code 產生器
├── vendor/
│   └── peerjs.esm.js          # 本地封裝 WebRTC 信令 SDK
└── tests/
    └── *.test.mjs             # Node.js 原生單元測試套件
```

---

### 本機開發與測試

專案採用原生 ES Modules 零建置架構，無需安裝複雜打包工具即可直接運行：

```bash
# 執行核心演算法單元測試（需 Node.js >= 20）
node --test tests/*.test.mjs

# 啟動本機靜態伺服器預覽（例如使用 Python 或 npx serve）
npx serve .
```

---

### 開發者彩蛋 (DevTools Console)

打開瀏覽器開發者工具（`F12` / `Cmd+Option+I`）切換至 **Console** 分頁，即可看到雙語資安提示與創作者致敬指令——無需輸入括號，直接輸入以下關鍵字並按 `Enter` 即可觸發攝影棚 Tally Light 微光與鼓勵語錄：

* `ON_AIR`（或 `on_air`）
* `SCOOP`（或 `scoop`）
* `QUEEN`（或 `queen`）

---

## English Documentation

### Overview

**SpeakFlow** is a zero-backend, 100% offline-capable bilingual teleprompter Progressive Web App (PWA) engineered for independent journalists, content creators, podcasters, and live streamers.

Built on the philosophy that you do not need a major television network behind you to command broadcast-grade pacing, SpeakFlow replaces clumsy cardboard cue cards with precision semantic segmentation, dynamic timing, and peer-to-peer director controls—with zero accounts, zero cloud servers, and zero tracking.

---

### Key Engineering & Broadcast Features

1. **Unicode UAX #29 Semantic Segmentation (`shared/segmenter.js`)**
   * Leverages native `Intl.Segmenter` boundary analysis to split bilingual Chinese/English scripts cleanly.
   * Keeps abbreviations (`Dr. Smith`), decimals (`3.14%`), version numbers (`v2.1.1`), and ellipses (`……`) intact.
2. **Dynamic Broadcast Pacing Engine (`shared/pacing.js`)**
   * **Word & Character Weighting**: Accurately counts CJK characters (including CJK Unified Ideographs Extensions B–F) alongside English hyphenated/decimal words.
   * **Natural Breathing Pauses**: Adds `0.15s` micro-pauses for internal commas/semicolons (`0.30s` for em-dashes `——`) on top of the `0.55s` end-of-sentence pause to mirror natural human delivery.
   * **Fixed-Seconds Mode**: Configurable fixed duration per sentence for short-form video scripting.
3. **Ergonomic 3-Tier Visual Stream (`styles.css` & `shared/prompter-core.js`)**
   * **Continuous Flow & Contrast Hierarchy**: Dimmed read lines (`0.22` opacity), visible upcoming preview (`0.42` opacity), and a full-contrast active line scaled to `1.38x` in layout flow—eliminating horizontal clipping and multi-line overlap.
   * **30% Eyeline Alignment**: Aligns the top edge of the active sentence to the `30%` viewport eyeline using forced synchronous reflow (`offsetWidth`), keeping the anchor's gaze close to the camera lens.
   * **Studio Hardware Ready**: Built-in horizontal mirror (for beam-splitter teleprompter glass), vertical flip, high-contrast black mode, and responsive breakpoints for portrait tablets and phones.
4. **Presenter Clicker Override & Local Voice Gate (`shared/vad.js`)**
   * **Instant Manual Control**: Full support for wireless presenter clickers, arrow keys, spacebar, or screen taps. Clicking a dimmed read line temporarily highlights it for 2 seconds for quick review.
   * **In-Memory Voice Activity Detection (VAD)**: Analyzes local microphone RMS volume via the Web Audio API—advancing when you speak and pausing when you stop. **Audio is never recorded, stored, or transmitted.**
5. **Dual-Device Director Console (`dual.html` & `app-dual.js`)**
   * **Zero-Server P2P Pairing**: Generates a 6-character Room Code, 6-digit PIN, and local vector QR Code. Includes brute-force protection (5-minute lockout after 5 failed PIN attempts).
   * **Camera-Safe Fullscreen UI**: Hides Room Code and PIN during fullscreen teleprompting so accidental camera framing never exposes pairing credentials on air.
   * **Double-Click Jump & Live Script Anchoring**: Prevents accidental jumps with a two-step arm-and-confirm click, and automatically anchors the anchor's current reading position (`findClosestSentence`) when pushing live breaking-news edits.
6. **Privacy-First & Zero-Data-Retention (ZDR)**
   * Scripts live strictly in tab-scoped `sessionStorage` by default and self-destruct when the tab closes, with optional explicit `localStorage` backup and one-click wipe.
   * Enforces strict Content Security Policy (`connect-src 'self'` in Solo mode, `script-src 'self'`, `style-src 'self'`).

---

### Dual-Device Pairing Workflow

1. **Same Room (Studio / Set)**: Open `dual.html` on the prompter iPad/laptop. Scan the on-screen **QR Code** with the director's phone to auto-fill the Room Code and PIN, then tap **Verify & Connect**.
2. **Remote Control Room**: If the director cannot scan the screen, tap **Copy Link with PIN** to share the pairing URL, or read the **6-character Room Code + 6-digit PIN** aloud for manual entry.

---

### Keyboard & Clicker Shortcuts

| Key / Gesture | Action |
| :--- | :--- |
| `Space` | Play / Pause auto-advancement |
| `↓` / `→` / `PageDown` | Next sentence (Presenter clicker compatible) |
| `↑` / `←` / `PageUp` | Previous sentence (Presenter clicker compatible) |
| `F` | Toggle fullscreen mode |
| `Esc` | Dismiss microphone permission dialog |
| Click dimmed read line | Peek/highlight for 2 seconds (click again to jump back) |
| Double-click line (Director) | Safe two-step jump to sentence |

---

### Local Development & Testing

SpeakFlow uses native ES Modules with zero build steps required:

```bash
# Run unit tests (requires Node.js >= 20)
node --test tests/*.test.mjs

# Serve locally
npx serve .
```

---

### Developer Console Easter Egg

Open browser DevTools (`F12` / `Cmd+Option+I`) and check the **Console** tab. Type any of the zero-parenthesis keywords below and press `Enter` to trigger studio tally-light glows and independent creator quotes:

* `ON_AIR` (or `on_air`)
* `SCOOP` (or `scoop`)
* `QUEEN` (or `queen`)

---

### License

MIT License · Maintained by **Joint Applied Research (J.A.R.)**
