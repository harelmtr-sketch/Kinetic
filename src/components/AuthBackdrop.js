import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import {
  AUTH_BACKDROP_ALL_STARS,
  AUTH_BACKDROP_BG_COLOR,
  AUTH_BACKDROP_DEPTH_COLOR,
  AUTH_BACKDROP_TINT_COLOR,
  buildBackdropRocks,
} from '../utils/treeBackdropUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BACKDROP_ROCKS = buildBackdropRocks({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });

const Starfield = React.memo(function Starfield({
  driftValue,
  twinkleValue,
  rockValue,
  rockBurstFx,
  rockBurstValue,
  treeMode,
}) {
  const rocks = treeMode ? BACKDROP_ROCKS.slice(0, 2) : BACKDROP_ROCKS;
  const stars = AUTH_BACKDROP_ALL_STARS;

  return (
    <View pointerEvents="none" style={styles.starfield}>
      {rocks.map((rock, index) => {
        const translateX = rockValue.interpolate({
          inputRange: [0, rock.entry, rock.exit, 1],
          outputRange: [rock.startX, rock.startX, rock.endX, rock.endX],
          extrapolate: 'clamp',
        });
        const translateY = rockValue.interpolate({
          inputRange: [0, rock.entry, (rock.entry + rock.exit) / 2, rock.exit, 1],
          outputRange: [0, 0, rock.sway, -rock.sway * 0.45, -rock.sway * 0.45],
          extrapolate: 'clamp',
        });
        const opacity = rockValue.interpolate({
          inputRange: [0, rock.entry, Math.min(rock.entry + 0.08, rock.exit), rock.exit, 1],
          outputRange: [0, 0, rock.opacity, 0, 0],
          extrapolate: 'clamp',
        });
        const scale = rockValue.interpolate({
          inputRange: [0, rock.entry, (rock.entry + rock.exit) / 2, rock.exit, 1],
          outputRange: [0.86, 0.86, 1.08, 0.94, 0.94],
          extrapolate: 'clamp',
        });
        const rotate = rockValue.interpolate({
          inputRange: [0, rock.entry, rock.exit, 1],
          outputRange: [rock.rotateStart, rock.rotateStart, rock.rotateEnd, rock.rotateEnd],
          extrapolate: 'clamp',
        });
        const pulse = driftValue.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
        const isBurstTarget = rockBurstFx?.rockId === rock.id;
        const burstFade = isBurstTarget
          ? rockBurstValue.interpolate({
            inputRange: [0, 0.14, 0.58, 1],
            outputRange: [1, 1, 0.26, 0],
            extrapolate: 'clamp',
          })
          : 1;
        const burstScale = isBurstTarget
          ? rockBurstValue.interpolate({
            inputRange: [0, 0.2, 1],
            outputRange: [1, 1.48, 0.16],
            extrapolate: 'clamp',
          })
          : 1;
        const resolvedOpacity = isBurstTarget
          ? Animated.multiply(opacity, burstFade)
          : opacity;
        const transforms = [{ translateX }, { translateY }, { rotate }, { scale }, { scale: pulse }];
        if (isBurstTarget) {
          transforms.push({ scale: burstScale });
        }

        return (
          <Animated.View
            key={`${rock.top}-${rock.entry}-${index}`}
            style={[styles.asteroid, treeMode && styles.asteroidTree, {
              top: rock.top,
              width: rock.width,
              height: rock.height,
              backgroundColor: rock.color,
              borderColor: rock.borderColor,
              opacity: resolvedOpacity,
              transform: transforms,
            }]}
          >
            <View style={[styles.asteroidCraterLarge, { backgroundColor: rock.craterColor }]} />
            <View style={[styles.asteroidCraterSmall, { backgroundColor: rock.craterColor }]} />
          </Animated.View>
        );
      })}

      {rockBurstFx && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.rockBurstRing, {
              left: rockBurstFx.x - 22,
              top: rockBurstFx.y - 22,
              opacity: rockBurstValue.interpolate({
                inputRange: [0, 0.12, 0.78, 1],
                outputRange: [0.15, 0.85, 0.08, 0],
                extrapolate: 'clamp',
              }),
              transform: [{
                scale: rockBurstValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.36, 1.65],
                  extrapolate: 'clamp',
                }),
              }],
            }]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.rockBurstFlash, {
              left: rockBurstFx.x - 12,
              top: rockBurstFx.y - 12,
              opacity: rockBurstValue.interpolate({
                inputRange: [0, 0.34, 1],
                outputRange: [0.4, 0.16, 0],
                extrapolate: 'clamp',
              }),
              transform: [{
                scale: rockBurstValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1.3],
                  extrapolate: 'clamp',
                }),
              }],
            }]}
          />
        </>
      )}

      {stars.map((star, index) => {
        const translateY = driftValue.interpolate({ inputRange: [0, 1], outputRange: [0, star.drift] });
        const translateX = twinkleValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, treeMode ? (index % 2 === 0 ? 0.8 : -0.8) : (index % 2 === 0 ? 1.5 : -1.5)],
        });
        const opacity = twinkleValue.interpolate({
          inputRange: [0, star.delay, Math.min(star.delay + 0.22, 1), 1],
          outputRange: treeMode ? [0.22, 0.86, 0.3, 0.7] : [0.18, 1, 0.26, 0.78],
        });
        const scale = twinkleValue.interpolate({
          inputRange: [0, star.delay, Math.min(star.delay + 0.22, 1), 1],
          outputRange: treeMode ? [0.88, 1.18, 0.96, 1.06] : [0.82, 1.42, 0.92, 1.12],
        });

        return (
          <Animated.View
            key={`${star.left}-${star.top}-${index}`}
            style={[styles.star, treeMode && styles.starTree, {
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              borderRadius: star.size,
              backgroundColor: star.color,
              opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            }]}
          />
        );
      })}
    </View>
  );
});

const AuthBackdrop = React.memo(function AuthBackdrop({
  style,
  driftValue: externalDriftValue,
  twinkleValue: externalTwinkleValue,
  rockValue: externalRockValue,
  rockBurstFx,
  treeMode = false,
}) {
  const managedDriftValue = useRef(new Animated.Value(0)).current;
  const managedTwinkleValue = useRef(new Animated.Value(0)).current;
  const managedRockValue = useRef(new Animated.Value(0)).current;
  const managedRockBurstValue = useRef(new Animated.Value(0)).current;
  const [activeRockBurst, setActiveRockBurst] = useState(null);

  const driftValue = externalDriftValue || managedDriftValue;
  const twinkleValue = externalTwinkleValue || managedTwinkleValue;
  const rockValue = externalRockValue || managedRockValue;
  const useManagedAnimation = !externalDriftValue && !externalTwinkleValue && !externalRockValue;

  useEffect(() => {
    if (!useManagedAnimation) {
      return undefined;
    }

    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(driftValue, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(driftValue, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const twinkleLoop = Animated.loop(Animated.sequence([
      Animated.timing(twinkleValue, { toValue: 1, duration: treeMode ? 6200 : 5200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(twinkleValue, { toValue: 0, duration: treeMode ? 6200 : 5200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const rockLoop = Animated.loop(Animated.sequence([
      Animated.timing(rockValue, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(rockValue, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));

    floatLoop.start();
    twinkleLoop.start();
    rockLoop.start();

    return () => {
      floatLoop.stop();
      twinkleLoop.stop();
      rockLoop.stop();
    };
  }, [driftValue, rockValue, treeMode, twinkleValue, useManagedAnimation]);

  useEffect(() => {
    if (!rockBurstFx?.id) {
      return undefined;
    }

    setActiveRockBurst(rockBurstFx);
    managedRockBurstValue.stopAnimation();
    managedRockBurstValue.setValue(0);

    const burst = Animated.timing(managedRockBurstValue, {
      toValue: 1,
      duration: 680,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    burst.start(({ finished }) => {
      if (finished) {
        setActiveRockBurst((current) => (current?.id === rockBurstFx.id ? null : current));
      }
    });

    return () => {
      burst.stop();
    };
  }, [managedRockBurstValue, rockBurstFx]);

  return (
    <View pointerEvents="none" style={[styles.backdrop, style]}>
      <View style={styles.backgroundTint} />
      <View style={styles.backgroundDepth} />
      <Starfield
        driftValue={driftValue}
        twinkleValue={twinkleValue}
        rockValue={rockValue}
        rockBurstFx={activeRockBurst}
        rockBurstValue={managedRockBurstValue}
        treeMode={treeMode}
      />
    </View>
  );
});

export default AuthBackdrop;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AUTH_BACKDROP_BG_COLOR,
  },
  backgroundTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AUTH_BACKDROP_TINT_COLOR,
  },
  backgroundDepth: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AUTH_BACKDROP_DEPTH_COLOR,
  },
  starfield: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    shadowColor: '#D7ECFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
    elevation: 3,
  },
  starTree: {
    shadowOpacity: 0.24,
    shadowRadius: 4,
    elevation: 0,
  },
  asteroid: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#CBD5E1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  asteroidTree: {
    shadowOpacity: 0.02,
    shadowRadius: 2,
  },
  asteroidCraterLarge: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 999,
    top: 3,
    left: 6,
    opacity: 0.72,
  },
  asteroidCraterSmall: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 999,
    right: 5,
    bottom: 3,
    opacity: 0.58,
  },
  rockBurstRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1.4,
    borderColor: 'rgba(196, 232, 255, 0.95)',
  },
  rockBurstFlash: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(147, 197, 253, 0.24)',
  },
});
