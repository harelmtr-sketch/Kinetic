export const AUTH_ROCK_CYCLE_MS = 16000;
export const AUTH_STAR_BASE_HEIGHT = 820;
export const AUTH_BACKDROP_BG_COLOR = '#01030A';
export const AUTH_BACKDROP_TINT_COLOR = 'rgba(1, 4, 12, 0.9)';
export const AUTH_BACKDROP_DEPTH_COLOR = 'rgba(3, 8, 18, 0.18)';

export const AUTH_BACKDROP_STARS = [
  { left: '6%', top: 58, size: 3, color: '#7DD3FC', delay: 0.08, drift: 7 },
  { left: '14%', top: 128, size: 2, color: '#F0ABFC', delay: 0.24, drift: 9 },
  { left: '82%', top: 92, size: 3, color: '#FDE68A', delay: 0.42, drift: 8 },
  { left: '72%', top: 170, size: 2, color: '#7DD3FC', delay: 0.16, drift: 6 },
  { left: '89%', top: 206, size: 2, color: '#C4B5FD', delay: 0.58, drift: 10 },
  { left: '10%', top: 246, size: 2, color: '#86EFAC', delay: 0.33, drift: 7 },
  { left: '26%', top: 302, size: 3, color: '#F9A8D4', delay: 0.12, drift: 9 },
  { left: '78%', top: 336, size: 2, color: '#7DD3FC', delay: 0.63, drift: 7 },
  { left: '16%', top: 492, size: 2, color: '#FDE68A', delay: 0.47, drift: 6 },
  { left: '80%', top: 580, size: 2, color: '#86EFAC', delay: 0.29, drift: 8 },
  { left: '10%', top: 724, size: 3, color: '#7DD3FC', delay: 0.18, drift: 7 },
  { left: '68%', top: 756, size: 2, color: '#C4B5FD', delay: 0.68, drift: 10 },
  { left: '45%', top: 114, size: 1.5, color: '#FFFFFF', delay: 0.11, drift: 6 },
  { left: '57%', top: 282, size: 1.5, color: '#93C5FD', delay: 0.36, drift: 5 },
  { left: '40%', top: 540, size: 1.5, color: '#FDE68A', delay: 0.51, drift: 6 },
];

export const AUTH_BACKDROP_EXTRA_STARS = Array.from({ length: 18 }, (_, index) => ({
  left: `${4 + ((index * 11) % 88)}%`,
  top: 44 + (index * 46),
  size: index % 4 === 0 ? 2.4 : 1.6,
  color: ['#7DD3FC', '#FDE68A', '#C4B5FD', '#86EFAC'][index % 4],
  delay: (index * 0.07) % 0.82,
  drift: 4 + (index % 5),
}));

export const AUTH_BACKDROP_ALL_STARS = [
  ...AUTH_BACKDROP_STARS,
  ...AUTH_BACKDROP_EXTRA_STARS,
];

const BACKDROP_ROCK_TEMPLATES = [
  {
    top: 152,
    width: 30,
    height: 14,
    startRef: 'left',
    startOffset: -72,
    endRef: 'right',
    endOffset: 42,
    sway: 12,
    rotateStart: '-16deg',
    rotateEnd: '12deg',
    color: 'rgba(148, 163, 184, 0.34)',
    borderColor: 'rgba(226, 232, 240, 0.16)',
    craterColor: 'rgba(71, 85, 105, 0.46)',
    entry: 0.02,
    exit: 0.4,
    opacity: 0.86,
  },
  {
    top: 286,
    width: 22,
    height: 11,
    startRef: 'right',
    startOffset: 36,
    endRef: 'left',
    endOffset: -64,
    sway: 14,
    rotateStart: '12deg',
    rotateEnd: '-18deg',
    color: 'rgba(161, 161, 170, 0.28)',
    borderColor: 'rgba(228, 228, 231, 0.12)',
    craterColor: 'rgba(82, 82, 91, 0.42)',
    entry: 0.2,
    exit: 0.58,
    opacity: 0.86,
  },
  {
    top: 516,
    width: 34,
    height: 16,
    startRef: 'left',
    startOffset: -88,
    endRef: 'right',
    endOffset: 60,
    sway: 18,
    rotateStart: '-10deg',
    rotateEnd: '18deg',
    color: 'rgba(113, 113, 122, 0.26)',
    borderColor: 'rgba(212, 212, 216, 0.12)',
    craterColor: 'rgba(63, 63, 70, 0.38)',
    entry: 0.46,
    exit: 0.88,
    opacity: 0.86,
  },
  {
    top: 704,
    width: 18,
    height: 10,
    startRef: 'right',
    startOffset: 28,
    endRef: 'left',
    endOffset: -54,
    sway: 10,
    rotateStart: '22deg',
    rotateEnd: '-14deg',
    color: 'rgba(148, 163, 184, 0.22)',
    borderColor: 'rgba(226, 232, 240, 0.1)',
    craterColor: 'rgba(71, 85, 105, 0.32)',
    entry: 0.66,
    exit: 0.98,
    opacity: 0.86,
  },
];

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const lerp = (from, to, t) => from + ((to - from) * t);

const interpolateStops = (value, inputRange, outputRange) => {
  const t = clamp01(value);

  if (t <= inputRange[0]) {
    return outputRange[0];
  }

  for (let index = 1; index < inputRange.length; index += 1) {
    if (t <= inputRange[index]) {
      const start = inputRange[index - 1];
      const end = inputRange[index];
      const local = end === start ? 0 : (t - start) / (end - start);
      return lerp(outputRange[index - 1], outputRange[index], local);
    }
  }

  return outputRange[outputRange.length - 1];
};

const resolveBackdropX = (width, ref, offset) => (
  ref === 'right' ? width + offset : offset
);

export function buildBackdropRocks(canvasSize) {
  const { width = 0 } = canvasSize || {};
  if (!width) return [];

  return BACKDROP_ROCK_TEMPLATES.map((rock, index) => ({
    ...rock,
    id: `auth_rock_${index}`,
    startX: resolveBackdropX(width, rock.startRef, rock.startOffset),
    endX: resolveBackdropX(width, rock.endRef, rock.endOffset),
    y: rock.top,
  }));
}

export function getBackdropRockState(rock, elapsedMs, motionMix = 1, sceneOpacity = 1) {
  const cycleProgress = ((elapsedMs / AUTH_ROCK_CYCLE_MS) % 1 + 1) % 1;
  const mid = (rock.entry + rock.exit) / 2;

  const x = interpolateStops(
    cycleProgress,
    [0, rock.entry, rock.exit, 1],
    [rock.startX, rock.startX, rock.endX, rock.endX],
  );
  const yOffset = interpolateStops(
    cycleProgress,
    [0, rock.entry, mid, rock.exit, 1],
    [0, 0, rock.sway, -rock.sway * 0.45, -rock.sway * 0.45],
  ) * motionMix;
  const opacity = interpolateStops(
    cycleProgress,
    [0, rock.entry, Math.min(rock.entry + 0.08, rock.exit), rock.exit, 1],
    [0, 0, rock.opacity, 0, 0],
  ) * sceneOpacity;
  const scale = interpolateStops(
    cycleProgress,
    [0, rock.entry, mid, rock.exit, 1],
    [0.86, 0.86, 1.08, 0.94, 0.94],
  );

  return {
    x,
    y: rock.y + yOffset,
    scale,
    opacity,
    progress: cycleProgress,
  };
}
