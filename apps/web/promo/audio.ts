import type { Cue } from './voice.ts';

const CHORDS = [
  [110, 164.81, 220, 277.18, 329.63, 493.88],
  [92.5, 138.59, 185, 220, 277.18, 369.99],
];
/** Seconds each chord takes to swell and fade into the other. */
const SWELL = 24;
const FADE = 2.5;

const chord = (notes: number[]) => notes.map((hz) => `sin(2*PI*${hz}*t)`).join('+');

/** A soft synthesized pad, so the video ships with music nobody else owns. */
function pad(seconds: number): string[] {
  const sway = `sin(2*PI*t/${SWELL})`;
  const tone = `0.08*((1+${sway})*(${chord(CHORDS[0])})+(1-${sway})*(${chord(CHORDS[1])}))`;

  return ['-f', 'lavfi', '-i', `aevalsrc=${tone}:d=${seconds}:s=48000`];
}

/** The music input: PROMO_MUSIC (a file you have the rights to) or the synthesized pad. */
const music = (seconds: number) =>
  process.env.PROMO_MUSIC ? ['-stream_loop', '-1', '-i', process.env.PROMO_MUSIC] : pad(seconds);

/**
 * ffmpeg arguments that add the soundtrack to the video at input 0: every narration line at its
 * cue time, over music that ducks while the voice talks. Empty when nothing was said.
 */
export function soundtrack(cues: Cue[], seconds: number): { inputs: string[]; output: string[] } {
  const voices = cues.map((_, index) => `[v${index}]`).join('');
  const delays = cues.map(
    ({ at }, index) =>
      `[${index + 1}:a]aresample=48000,adelay=${Math.round(at * 1000)}:all=1[v${index}]`,
  );
  const bed = `[${cues.length + 1}:a]lowpass=f=1200,aecho=0.8:0.7:90:0.35,volume=0.07,afade=t=in:d=${FADE},afade=t=out:st=${seconds - FADE}:d=${FADE}[bed]`;
  const mix = [
    ...delays,
    `${voices}amix=inputs=${cues.length}:normalize=0,asplit[voice][key]`,
    bed,
    '[bed][key]sidechaincompress=threshold=0.05:ratio=4:attack=15:release=700[ducked]',
    '[voice][ducked]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]',
  ].join(';');

  if (!cues.length) return { inputs: [], output: [] };

  return {
    inputs: [...cues.flatMap(({ file }) => ['-i', file]), ...music(seconds)],
    output: [
      '-filter_complex',
      mix,
      '-map',
      '0:v',
      '-map',
      '[a]',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-t',
      `${seconds}`,
    ],
  };
}
