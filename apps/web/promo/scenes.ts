import type { Page } from '@playwright/test';
import { browse, click, pause, scene, scrollTo, stage } from './stage.ts';
import { say } from './voice.ts';

const INSTALL_LINES = 9;
const BEATS = ['problem', 'options', 'brand'];

/** The cold open: the problem, the options, the product. Each beat lasts what its line lasts. */
export async function intro(page: Page): Promise<void> {
  await stage(page, 'show', 'intro');
  for (const beat of BEATS) {
    const said = say(`intro.${beat}`);

    await stage(page, 'beat', beat);
    await pause(page, 3_200);
    await said();
  }
}

/** Scene: a page of the live site. */
export async function site(page: Page, url: string, cue: string, headline: string) {
  const said = say(cue);

  await scene(page, 'browser', headline);
  await browse(page, url);
  await pause(page, 2_500);
  await said();
}

/**
 * Scene: the job page, where a visitor re-runs the acceptance test in the browser.
 * `story` picks the narration and `captions` are the two headlines.
 */
export async function verify(page: Page, url: string, story: string, captions: [string, string]) {
  const shown = say(`${story}.page`);

  await scene(page, 'browser', captions[0]);
  const frame = await browse(page, url);

  await pause(page, 1_800);
  await shown();
  const verified = say(`${story}.verify`);

  await stage(page, 'headline', captions[1]);
  await click(page, frame.getByRole('button', { name: 'Verify independently' }));
  await frame.getByRole('status').waitFor();
  await scrollTo(frame, '.verification', 120);
  await pause(page, 2_600);
  await verified();
}

/** Scene: the MCP configuration, revealed line by line. */
export async function install(page: Page): Promise<void> {
  const said = say('install');

  await scene(page, 'install', 'One block in your MCP client. Your agent does the rest.');
  for (const count of Array.from({ length: INSTALL_LINES }, (_, index) => index + 1)) {
    await stage(page, 'lines', count);
    await pause(page, 240);
  }
  await pause(page, 1_200);
  await said();
}

export async function outro(page: Page): Promise<void> {
  const said = say('outro');

  await stage(page, 'show', 'outro');
  await stage(page, 'beat', 'outro');
  await pause(page, 5_000);
  await said();
}
