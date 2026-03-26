// Auto-generated nbaPlayinProbs.ts — do not edit manually
// P(home wins) for each play-in game slot at actual play-in DayNums.
// 7v8=Apr14 (DayNum 175), 9v10=Apr15 (DN176), final=Apr17 (DN178).
// Updated: 2026-03-26

export type PlayinSlot = '7v8' | '9v10' | 'final';

// [slot, homeId, awayId, pHomeWins]
const _PI_DATA: [PlayinSlot, number, number, number][] = [

];

const _PI = new Map<string, number>(
  _PI_DATA.map(([slot, h, a, p]) => [`${slot}:${h}:${a}`, p])
);

/** P(home wins play-in game) using actual play-in DayNum (Apr 14-17). */
export function getPlayinProb(
  slot: PlayinSlot, homeId: number, awayId: number,
): number {
  return _PI.get(`${slot}:${homeId}:${awayId}`) ?? 0.5;
}
