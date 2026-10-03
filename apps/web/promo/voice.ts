import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NARRATION } from './narration.ts';

type Clip = { file: string; seconds: number };
export type Cue = { file: string; at: number };

/** Silence left after a line before the video moves on. */
const BREATH_MS = 450;
/** What a step lasts when there is no voice-over. */
const SILENT_BEAT_MS = 2_400;
const PROBE = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0'];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const model = process.env.PIPER_VOICE;
const cues: Cue[] = [];
let clips: Record<string, Clip> = {};
let started = 0;

/** Speaks one line with Piper (https://github.com/OHF-Voice/piper1-gpl) into a WAV file. */
function synthesize(dir: string, id: string, text: string): Clip {
  const file = join(dir, `${id}.wav`);

  execFileSync(process.env.PIPER ?? 'piper', ['-m', model as string, '-f', file], { input: text });

  return { file, seconds: Number(execFileSync('ffprobe', [...PROBE, file])) };
}

/** Renders the whole narration. Without PIPER_VOICE the video is recorded silent. */
export function prepareVoice(): void {
  const dir = mkdtempSync(join(tmpdir(), 'agent-escrow-voice-'));
  const lines = model ? Object.entries(NARRATION) : [];

  clips = Object.fromEntries(lines.map(([id, text]) => [id, synthesize(dir, id, text)]));
}

/** Marks the instant the recording starts: cue times are measured from here. */
export function startTrack(): void {
  started = Date.now();
}

/**
 * Starts a narration line now. Returns a function that resolves once the line was said, so a
 * scene can do its work while the voice talks and then wait for it.
 */
export function say(id: string): () => Promise<void> {
  const clip = clips[id];
  const ends = Date.now() + (clip ? clip.seconds * 1000 + BREATH_MS : SILENT_BEAT_MS);

  if (clip) cues.push({ file: clip.file, at: (Date.now() - started) / 1000 });

  return () => wait(Math.max(0, ends - Date.now()));
}

export const spokenCues = (): Cue[] => cues;
