#!/usr/bin/env node
/**
 * Report an MP3's duration in seconds by walking its frame headers.
 *
 * This box has no ffprobe. edge-tts emits MPEG-2 Layer III at 24 kHz, which uses
 * different bitrate tables, sample rates and samples-per-frame from MPEG-1 — so
 * all three versions are handled rather than assumed.
 *
 * Header layout after the 11-bit sync word:
 *   version  2 bits  (3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5)
 *   layer    2 bits  (1 = Layer III)
 */
import { readFileSync } from 'node:fs';

const BITRATE_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATE_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

const SAMPLE_RATES = {
  3: [44100, 48000, 32000, 0], // MPEG-1
  2: [22050, 24000, 16000, 0], // MPEG-2
  0: [11025, 12000, 8000, 0], // MPEG-2.5
};

const path = process.argv[2];
if (path === undefined) {
  process.stderr.write('usage: mp3-duration.mjs <file.mp3>\n');
  process.exit(2);
}

const data = readFileSync(path);
let offset = 0;
let seconds = 0;

// Skip an ID3v2 tag if present.
if (data.length > 10 && data.toString('latin1', 0, 3) === 'ID3') {
  const size =
    ((data[6] & 0x7f) << 21) | ((data[7] & 0x7f) << 14) | ((data[8] & 0x7f) << 7) | (data[9] & 0x7f);
  offset = 10 + size;
}

while (offset + 4 <= data.length) {
  if (data[offset] !== 0xff || (data[offset + 1] & 0xe0) !== 0xe0) {
    offset += 1;
    continue;
  }

  const version = (data[offset + 1] >> 3) & 0x03;
  const layer = (data[offset + 1] >> 1) & 0x03;
  const rates = SAMPLE_RATES[version];

  // Only Layer III (bits 01) with a known version is of interest.
  if (layer !== 0x01 || rates === undefined) {
    offset += 1;
    continue;
  }

  const isV1 = version === 3;
  const table = isV1 ? BITRATE_V1_L3 : BITRATE_V2_L3;
  const bitrate = table[(data[offset + 2] >> 4) & 0x0f];
  const sampleRate = rates[(data[offset + 2] >> 2) & 0x03];

  if (!bitrate || !sampleRate) {
    offset += 1;
    continue;
  }

  const padding = (data[offset + 2] >> 1) & 0x01;
  const samplesPerFrame = isV1 ? 1152 : 576;
  const frameLength = Math.floor((samplesPerFrame / 8) * ((bitrate * 1000) / sampleRate)) + padding;
  if (frameLength <= 4) break;

  seconds += samplesPerFrame / sampleRate;
  offset += frameLength;
}

process.stdout.write(seconds.toFixed(2));
