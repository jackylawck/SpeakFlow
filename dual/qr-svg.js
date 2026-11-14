/**
 * 零外部依賴、符合嚴格 CSP (script-src 'self') 的純前端 SVG QR Code 生成器
 * 支援 QR Version 1–6 (Byte Mode, Error Correction Level L, ISO 標準 4-module Quiet Zone)
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

const QR_SPECS = [
  [1, 21, 19, 7, []],
  [2, 25, 34, 10, [6, 18]],
  [3, 29, 55, 15, [6, 22]],
  [4, 33, 80, 20, [6, 26]],
  [5, 37, 108, 26, [6, 30]],
  [6, 41, 136, 18, [6, 34]]
];

function encodeByteMode(text) {
  const bytes = new TextEncoder().encode(text);
  const spec = QR_SPECS.find((s) => bytes.length <= s[2] - 2);
  if (!spec) return null;

  const [ver, size, dataCap, ecPerBlock, align] = spec;
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);
  pushBits(0, Math.min(4, dataCap * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(dataCap);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    dataBytes[i] = byte;
  }
  const pads = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < dataCap; i++, p++) {
    dataBytes[i] = pads[p % 2];
  }

  let finalCodewords;
  if (ver === 6) {
    const b1 = dataBytes.slice(0, 68);
    const b2 = dataBytes.slice(68, 136);
    const ec1 = rsRemainder(b1, ecPerBlock);
    const ec2 = rsRemainder(b2, ecPerBlock);
    finalCodewords = new Uint8Array(136 + 36);
    for (let i = 0; i < 68; i++) {
      finalCodewords[i * 2] = b1[i];
      finalCodewords[i * 2 + 1] = b2[i];
    }
    for (let i = 0; i < 18; i++) {
      finalCodewords[136 + i * 2] = ec1[i];
      finalCodewords[136 + i * 2 + 1] = ec2[i];
    }
  } else {
    const ec = rsRemainder(dataBytes, ecPerBlock);
    finalCodewords = new Uint8Array(dataCap + ecPerBlock);
    finalCodewords.set(dataBytes);
    finalCodewords.set(ec, dataCap);
  }

  const grid = Array.from({ length: size }, () => new Uint8Array(size));
  const setReserved = (r, c, dark) => {
    if (r >= 0 && r < size && c >= 0 && c < size) grid[r][c] = dark ? 2 : 1;
  };

  const drawFinder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const dark =
          r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
          (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setReserved(r0 + r, c0 + c, dark);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  if (align.length) {
    for (const r of align) {
      for (const c of align) {
        if (grid[r][c] !== 0) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const dark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setReserved(r + dr, c + dc, dark);
          }
        }
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    if (grid[6][i] === 0) setReserved(6, i, i % 2 === 0);
    if (grid[i][6] === 0) setReserved(i, 6, i % 2 === 0);
  }
  setReserved(size - 8, 8, true);

  const fmtBits = "111011111000100";
  for (let i = 0; i < 6; i++) {
    setReserved(8, i, fmtBits[i] === "1");
    setReserved(size - 1 - i, 8, fmtBits[i] === "1");
  }
  setReserved(8, 7, fmtBits[6] === "1");
  setReserved(8, 8, fmtBits[7] === "1");
  setReserved(7, 8, fmtBits[8] === "1");
  setReserved(size - 7, 8, fmtBits[6] === "1");
  for (let i = 0; i < 8; i++) {
    setReserved(8, size - 8 + i, fmtBits[7 + i] === "1");
    if (i < 6) setReserved(5 - i, 8, fmtBits[9 + i] === "1");
  }

  let bitIdx = 0;
  const totalBits = finalCodewords.length * 8;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (grid[r][c] === 0) {
          let bit = 0;
          if (bitIdx < totalBits) {
            bit = (finalCodewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
          if ((r + c) % 2 === 0) bit ^= 1;
          grid[r][c] = bit ? 4 : 3;
        }
      }
    }
    upward = !upward;
  }

  return { size, grid };
}

export function createQrSvgElement(text, pxSize = 116) {
  const encoded = encodeByteMode(text);
  if (!encoded) {
    console.warn("[QR] URL exceeds V6-L capacity (134 bytes):", text.length, "chars");
    return null;
  }

  const { size, grid } = encoded;
  const quiet = 4;
  const total = size + quiet * 2;
  const ns = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${total} ${total}`);
  svg.setAttribute("width", String(pxSize));
  svg.setAttribute("height", String(pxSize));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "QR Code");

  const bg = document.createElementNS(ns, "rect");
  bg.setAttribute("width", String(total));
  bg.setAttribute("height", String(total));
  bg.setAttribute("rx", "2");
  bg.setAttribute("fill", "#ffffff");
  svg.appendChild(bg);

  let d = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === 2 || grid[r][c] === 4) {
        d += `M${c + quiet},${r + quiet}h1v1h-1z`;
      }
    }
  }

  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "#090b0e");
  svg.appendChild(path);

  return svg;
}
