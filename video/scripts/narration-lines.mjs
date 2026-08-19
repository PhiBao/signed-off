#!/usr/bin/env node
/** Print the narration as `scene<TAB>text`, for the shell to consume. */
import { NARRATION } from '../src/narration.ts';

for (const [scene, text] of Object.entries(NARRATION)) {
  process.stdout.write(`${scene}\t${text.replace(/\s+/g, ' ').trim()}\n`);
}
