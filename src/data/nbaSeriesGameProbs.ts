// Auto-generated nbaSeriesGameProbs.ts — do not edit manually
// Encodes P(hs wins game) keyed by (roundKey, hsId, lsId, gameNum, hsWins, lsWins).
// Uses ACTUAL playoff game DayNums per round — identical to Python CELL 11b.
// Updated: 2026-04-01

const _T = [] as const;
const _TI = new Map<number, number>((_T as unknown as number[]).map((id, i) => [id, i]));
const N_T = 0;
const _R = ["east_r1","west_r1","east_r2","west_r2","east_cf","west_cf","finals"] as const;
const _RI = new Map<string, number>((_R as unknown as string[]).map((r, i) => [r, i]));
const _STATES: [number, number, number][] = [[1,0,0],[2,0,1],[2,1,0],[3,0,2],[3,1,1],[3,2,0],[4,0,3],[4,1,2],[4,2,1],[4,3,0],[5,1,3],[5,2,2],[5,3,1],[6,2,3],[6,3,2],[7,3,3]];
const _SI = new Map<string, number>(_STATES.map(([g, hw, lw], i) => [`${g}_${hw}_${lw}`, i]));
const N_S = 16;

function _b64toU16(b64: string): Uint16Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
  return new Uint16Array(bytes.buffer);
}

const _SGP = _b64toU16(
  ''
);

export type RoundKey = 'east_r1'|'west_r1'|'east_r2'|'west_r2'|'east_cf'|'west_cf'|'finals';

/**
 * P(hs wins game g) given round + series state.
 * Uses actual playoff DayNum for that round.
 * Returns 0.5 if not found.
 */
export function getSeriesGameProb(
  roundKey: RoundKey,
  hsId: number, lsId: number,
  gameNum: number, hsWins: number, lsWins: number,
): number {
  const ri = _RI.get(roundKey);
  const i = _TI.get(hsId), j = _TI.get(lsId);
  const s = _SI.get(`${gameNum}_${hsWins}_${lsWins}`);
  if (ri === undefined || i === undefined || j === undefined || s === undefined) return 0.5;
  return _SGP[ri * N_T * N_T * N_S + i * N_T * N_S + j * N_S + s] / 65535;
}

/** P(hs wins best-of-7 series) via DP over per-round per-state game probs. */
export function getSeriesWinProb(roundKey: RoundKey, hsId: number, lsId: number): number {
  const memo = new Map<string, number>();
  function dp(hw: number, lw: number): number {
    if (hw === 4) return 1.0;
    if (lw === 4) return 0.0;
    const k = `${hw}_${lw}`;
    if (memo.has(k)) return memo.get(k)!;
    const gn = hw + lw + 1;
    const p = getSeriesGameProb(roundKey, hsId, lsId, gn, hw, lw);
    const v = p * dp(hw + 1, lw) + (1 - p) * dp(hw, lw + 1);
    memo.set(k, v);
    return v;
  }
  return dp(0, 0);
}
