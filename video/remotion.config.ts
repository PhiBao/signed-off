import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// The box has no system ffmpeg or GPU; Remotion's bundled renderer with a
// software GL backend is what works here.
Config.setChromiumOpenGlRenderer('swangle');
Config.setEntryPoint('./src/index.ts');
