/**
 * SpeakFlow Studio Easter Egg Module
 * 致敬每一位無大台資源、依然堅持專業與速度的獨立創作者與自媒體人。
 *
 * 架構設計重點：
 * 1. Anti-Minifier Console Binding：動態字串拼接繞過 AST drop_console 靜態清除。
 * 2. Zero-Parenthesis Getters：Object.defineProperty 掛載不可枚舉存取器，支援大小寫免括號觸發。
 * 3. FX_GC 冪等資源回收器：自動清除殘留計時器、強制同步重繪重置動畫幀，結束後自動卸載狀態。
 * 4. CSP & Photosensitivity Guard：完全相容 style-src 'self'，支援 prefers-reduced-motion 與 WCAG 防光敏保護。
 */

const _con = window["con" + "sole"];
const log = _con && typeof _con.log === "function" ? _con.log.bind(_con) : () => {};
const warn = _con && typeof _con.warn === "function" ? _con.warn.bind(_con) : () => {};

const FX_CLASSES = ["sf-fx-onair", "sf-fx-scoop", "sf-fx-queen"];
const FX_DURATION_MS = 1200;

/**
 * 統一特效資源與生命週期管理器（Idempotency & Zero Memory Leak）
 */
const FX_GC = {
  timerId: null,

  trigger(fxClass) {
    // 尊重系統無障礙設定（前庭與光敏保護）：減弱動態模式下僅輸出 Console 鼓勵訊息，不觸發視覺動畫
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) return;

    const root = document.body;
    if (!root) return;

    // 1. 清除前一次未結束的計時器，防止連按狂刷導致狀態錯亂
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    // 2. 卸載所有舊特效 Class
    root.classList.remove(...FX_CLASSES);

    // 3. 強制瀏覽器同步重繪（Synchronous Reflow），確保連續觸發同指令時動畫幀從 0% 重新播放
    void root.offsetWidth;

    // 4. 掛載新特效（樣式規則定義於同源 styles.css，100% 符合 style-src 'self' 嚴格 CSP）
    root.classList.add(fxClass);

    // 5. 動畫結束後自動回收 Class，確保零 DOM 狀態殘留
    this.timerId = setTimeout(() => {
      root.classList.remove(fxClass);
      this.timerId = null;
    }, FX_DURATION_MS);
  }
};

function printBanner(title, zhLine, enLine, accentColor = "#facc15") {
  log(
    `%c ${title} `,
    `background:${accentColor};color:#090b0e;font-weight:800;padding:3px 8px;border-radius:4px;font-size:12px;`
  );
  log(
    `%c${zhLine}\n%c${enLine}`,
    "color:#f3f4f6;font-size:12px;line-height:1.65;",
    "color:#94a3b8;font-size:11px;line-height:1.55;"
  );
}

const COMMANDS = {
  ON_AIR() {
    FX_GC.trigger("sf-fx-onair");
    printBanner(
      "🔴 ON AIR · 黃金時段已開啟",
      "「有本事，邊度都係你嘅舞台。唔靠大台資源，一塊空地一樣起得到高樓——新聞唔等人，準備好就順住講。」",
      "With real skill, anywhere is your prime-time stage. No big network needed—build your tower from scratch. News waits for no one.",
      "#ef4444"
    );
    return "🎬 [SpeakFlow] ON_AIR — Studio Tally Light activated.";
  },

  SCOOP() {
    FX_GC.trigger("sf-fx-scoop");
    printBanner(
      "⚡ BREAKING SCOOP · 直播節奏極致",
      "「四流讀稿照字硬讀，一流主播帶領觀眾節奏。我只示範一次——呢個就係零後端、零延遲提詞嘅極致。」",
      "4th-rate readers merely recite text; 1st-rate anchors command the rhythm. Watch closely—this is zero-latency teleprompting at its peak.",
      "#3b82f6"
    );
    return "⚡ [SpeakFlow] SCOOP — Breaking news pulse triggered.";
  },

  QUEEN() {
    FX_GC.trigger("sf-fx-queen");
    printBanner(
      "👑 QUEEN OF YOUR STAGE · 公開平台獨立宣言",
      "「唔使人叫你『阿姐』，自己掌握節奏先至係真正嘅女王。有得揀至係老闆——唔舉紙牌、唔靠大台，直接向你嘅觀眾負責。」",
      "You don't need anyone calling you 'Boss'—owning your rhythm makes you the true Queen of News. No cue cards, no gatekeepers: answer only to your audience.",
      "#facc15"
    );
    return "👑 [SpeakFlow] QUEEN — Independent Creator Creed displayed.";
  }
};

let initialized = false;

export function initEasterEgg() {
  if (initialized) return;
  initialized = true;

  // 1. Self-XSS 資安治理提示（Zero-Data-Retention 安全宣導）
  warn(
    "%c🛡️ SpeakFlow Security Advisory / 資安防詐提示",
    "color:#facc15;font-weight:700;font-size:12px;"
  );
  log(
    "%c請勿在此貼上任何來源不明的程式碼，以免遭受 Self-XSS 攻擊。\nNever paste unknown scripts here. SpeakFlow enforces strict Zero-Data-Retention (ZDR).\n%c💡 創作者彩蛋指令（免括號直接輸入按 Enter）：ON_AIR | SCOOP | QUEEN",
    "color:#94a3b8;font-size:11px;line-height:1.5;",
    "color:#38bdf8;font-size:11px;font-weight:600;"
  );

  // 2. 掛載零括號指令攔截器（Zero-Parenthesis Getters），支援全大寫與全小寫，且不污染 Object.keys(window)
  Object.entries(COMMANDS).forEach(([cmdName, handler]) => {
    const variants = [cmdName, cmdName.toLowerCase()];
    variants.forEach((prop) => {
      if (Object.prototype.hasOwnProperty.call(window, prop)) return;
      try {
        Object.defineProperty(window, prop, {
          get() {
            return handler();
          },
          enumerable: false,
          configurable: true
        });
      } catch {}
    });
  });

  // 3. 同時保留傳統命名空間方法呼叫（window.speakflow.queen() 等），互不衝突
  if (!Object.prototype.hasOwnProperty.call(window, "speakflow")) {
    try {
      Object.defineProperty(window, "speakflow", {
        value: Object.freeze({
          onAir: COMMANDS.ON_AIR,
          scoop: COMMANDS.SCOOP,
          queen: COMMANDS.QUEEN,
          help: () => {
            log(
              "%c可用指令 / Commands: ON_AIR (on_air), SCOOP (scoop), QUEEN (queen)",
              "color:#facc15;font-size:12px;"
            );
            return "🎙️ SpeakFlow Easter Egg Ready.";
          }
        }),
        enumerable: false,
        configurable: true
      });
    } catch {}
  }
}
