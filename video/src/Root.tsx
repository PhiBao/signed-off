import React from 'react';
import { Composition } from 'remotion';
import { DURATION_IN_FRAMES, FPS } from './config';
import { SignedOffVideo } from './Video';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="SignedOff"
    component={SignedOffVideo}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
