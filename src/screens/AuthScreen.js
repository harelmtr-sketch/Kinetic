import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KineticLogo from '../components/KineticLogo.js';
import {
  sendPasswordReset,
  signIn,
  signInWithSocial,
  signUp,
} from '../services/authService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SAVED_LOGIN_KEY = 'kinetic.savedLogin';

const STARS = [
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

const EXTRA_STARS = Array.from({ length: 18 }, (_, index) => ({
  left: `${4 + ((index * 11) % 88)}%`,
  top: 44 + (index * 46),
  size: index % 4 === 0 ? 2.4 : 1.6,
  color: ['#7DD3FC', '#FDE68A', '#C4B5FD', '#86EFAC'][index % 4],
  delay: (index * 0.07) % 0.82,
  drift: 4 + (index % 5),
}));

const ALL_STARS = [...STARS, ...EXTRA_STARS];

const ASTEROIDS = [
  {
    top: 152,
    width: 30,
    height: 14,
    startX: -72,
    endX: SCREEN_WIDTH + 42,
    sway: 12,
    rotateStart: '-16deg',
    rotateEnd: '12deg',
    color: 'rgba(148, 163, 184, 0.34)',
    borderColor: 'rgba(226, 232, 240, 0.16)',
    craterColor: 'rgba(71, 85, 105, 0.46)',
    entry: 0.02,
    exit: 0.4,
  },
  {
    top: 286,
    width: 22,
    height: 11,
    startX: SCREEN_WIDTH + 36,
    endX: -64,
    sway: 14,
    rotateStart: '12deg',
    rotateEnd: '-18deg',
    color: 'rgba(161, 161, 170, 0.28)',
    borderColor: 'rgba(228, 228, 231, 0.12)',
    craterColor: 'rgba(82, 82, 91, 0.42)',
    entry: 0.2,
    exit: 0.58,
  },
  {
    top: 516,
    width: 34,
    height: 16,
    startX: -88,
    endX: SCREEN_WIDTH + 60,
    sway: 18,
    rotateStart: '-10deg',
    rotateEnd: '18deg',
    color: 'rgba(113, 113, 122, 0.26)',
    borderColor: 'rgba(212, 212, 216, 0.12)',
    craterColor: 'rgba(63, 63, 70, 0.38)',
    entry: 0.46,
    exit: 0.88,
  },
  {
    top: 704,
    width: 18,
    height: 10,
    startX: SCREEN_WIDTH + 28,
    endX: -54,
    sway: 10,
    rotateStart: '22deg',
    rotateEnd: '-14deg',
    color: 'rgba(148, 163, 184, 0.22)',
    borderColor: 'rgba(226, 232, 240, 0.1)',
    craterColor: 'rgba(71, 85, 105, 0.32)',
    entry: 0.66,
    exit: 0.98,
  },
];

function Field({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  autoComplete,
  keyboardType,
  showToggle = false,
  isVisible = false,
  onToggleVisibility,
}) {
  return (
    <View style={styles.fieldShell}>
      <View style={styles.fieldIconWrap}>
        <Ionicons name={icon} size={18} color="rgba(173, 191, 218, 0.76)" />
      </View>
      <TextInput
        autoCapitalize="none"
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="rgba(173,191,218,0.44)"
        secureTextEntry={secureTextEntry && !isVisible}
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
      />
      {showToggle && (
        <Pressable style={styles.fieldToggle} onPress={onToggleVisibility}>
          <Ionicons
            name={isVisible ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color="rgba(173, 191, 218, 0.76)"
          />
        </Pressable>
      )}
    </View>
  );
}

function Starfield({ driftValue, twinkleValue, rockValue }) {
  return (
    <View pointerEvents="none" style={styles.starfield}>
      {ASTEROIDS.map((rock, index) => {
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
          outputRange: [0, 0, 0.86, 0, 0],
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

        const pulse = driftValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1.04],
        });

        return (
          <Animated.View
            key={`${rock.top}-${rock.entry}-${index}`}
            style={[
              styles.asteroid,
              {
                top: rock.top,
                width: rock.width,
                height: rock.height,
                backgroundColor: rock.color,
                borderColor: rock.borderColor,
                opacity,
                transform: [
                  { translateX },
                  { translateY },
                  { rotate },
                  { scale },
                  { scale: pulse },
                ],
              },
            ]}
          >
            <View style={[styles.asteroidCraterLarge, { backgroundColor: rock.craterColor }]} />
            <View style={[styles.asteroidCraterSmall, { backgroundColor: rock.craterColor }]} />
          </Animated.View>
        );
      })}

      {ALL_STARS.map((star, index) => {
        const translateY = driftValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, star.drift],
        });

        const translateX = twinkleValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, index % 2 === 0 ? 1.5 : -1.5],
        });

        const opacity = twinkleValue.interpolate({
          inputRange: [0, star.delay, Math.min(star.delay + 0.22, 1), 1],
          outputRange: [0.18, 1, 0.26, 0.78],
        });

        const scale = twinkleValue.interpolate({
          inputRange: [0, star.delay, Math.min(star.delay + 0.22, 1), 1],
          outputRange: [0.82, 1.42, 0.92, 1.12],
        });

        return (
          <Animated.View
            key={`${star.left}-${star.top}-${index}`}
            style={[
              styles.star,
              {
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                borderRadius: star.size,
                backgroundColor: star.color,
                opacity,
                transform: [{ translateX }, { translateY }, { scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialProvider, setSocialProvider] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const floatValue = useRef(new Animated.Value(0)).current;
  const twinkleValue = useRef(new Animated.Value(0)).current;
  const rockValue = useRef(new Animated.Value(0)).current;
  const keyboardShift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    const restoreSavedLogin = async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_LOGIN_KEY);
        if (!raw || !isMounted) {
          return;
        }

        const savedLogin = JSON.parse(raw);
        setRememberMe(savedLogin.remember !== false);
        setEmail(savedLogin.email || '');
        setPassword(savedLogin.password || '');
      } catch (_error) {
        // Ignore malformed local auth cache.
      }
    };

    restoreSavedLogin();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatValue, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatValue, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const twinkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkleValue, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(twinkleValue, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const rockLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(rockValue, {
          toValue: 1,
          duration: 16000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(rockValue, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    floatLoop.start();
    twinkleLoop.start();
    rockLoop.start();

    return () => {
      floatLoop.stop();
      twinkleLoop.stop();
      rockLoop.stop();
    };
  }, [floatValue, twinkleValue, rockValue]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const keyboardHeight = event.endCoordinates?.height || 0;
      const targetShift = -Math.min(150, Math.max(72, keyboardHeight * 0.32));

      Animated.timing(keyboardShift, {
        toValue: targetShift,
        duration: Platform.OS === 'ios' ? 240 : 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(keyboardShift, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? 220 : 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardShift]);

  const logoTranslateY = floatValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });

  const cardTranslateY = floatValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  const copy = useMemo(() => (
    mode === 'signIn'
      ? {
        title: 'Welcome back',
        subtitle: 'Sign in to track your progress',
        submitLabel: 'Sign In',
        switchPrompt: "Don't have an account?",
        switchLabel: 'Sign up',
      }
      : {
        title: 'Create account',
        subtitle: 'Set up cloud save and sync your progress',
        submitLabel: 'Create Account',
        switchPrompt: 'Already have an account?',
        switchLabel: 'Use existing login',
      }
  ), [mode]);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }

    if (!normalizedEmail.includes('@')) {
      setErrorMessage('Enter a valid email address with @.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signUp' && password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (mode === 'signIn') {
        await signIn(normalizedEmail, password);
      } else {
        const result = await signUp(normalizedEmail, password);
        if (result.user && !result.session) {
          Alert.alert(
            'Check your email',
            'Your account was created. Confirm your email, then sign in.',
          );
          setMode('signIn');
        }
      }

      if (rememberMe) {
        await AsyncStorage.setItem(SAVED_LOGIN_KEY, JSON.stringify({
          email: normalizedEmail,
          password,
          remember: true,
        }));
      } else {
        await AsyncStorage.removeItem(SAVED_LOGIN_KEY);
      }
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to continue right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialAuth = async (provider) => {
    setSocialProvider(provider);
    setErrorMessage('');

    try {
      await signInWithSocial(provider);
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to continue with social sign-in.');
    } finally {
      setSocialProvider('');
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setErrorMessage('Enter your email first so we can send a reset link.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await sendPasswordReset(normalizedEmail);
      Alert.alert(
        'Reset email sent',
        'Open the reset link on your phone in this app to finish resetting your password.',
      );
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to send a reset email right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.backdrop}>
        <View style={styles.backgroundTint} />
        <View style={styles.backgroundDepth} />
        <Starfield driftValue={floatValue} twinkleValue={twinkleValue} rockValue={rockValue} />
      </View>

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 2,
            paddingBottom: Math.max(insets.bottom, 18),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.hero,
            {
              transform: [{ translateY: Animated.add(logoTranslateY, keyboardShift) }],
            },
          ]}
        >
          <View style={styles.logoHalo}>
            <View style={styles.logoHaloRing} />
            <View style={styles.logoCoreBox}>
              <KineticLogo size={60} glow={false} />
            </View>
          </View>
          <Text style={styles.brand}>Kinetic</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateY: Animated.add(cardTranslateY, keyboardShift) }],
            },
          ]}
        >
          <View style={styles.signalBadge}>
            <View style={styles.signalDot} />
            <Text style={styles.signalText}>Supabase connected</Text>
          </View>

          <View style={styles.copyBlock}>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
          </View>

          <View style={styles.form}>
            <Field
              icon="mail-outline"
              placeholder="yourname@example.com"
              value={email}
              onChangeText={setEmail}
              autoComplete="email"
              keyboardType="email-address"
            />

            <Field
              icon="lock-closed-outline"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              showToggle
              isVisible={isPasswordVisible}
              onToggleVisibility={() => setIsPasswordVisible((current) => !current)}
            />

            {mode === 'signUp' && (
              <Field
                icon="shield-checkmark-outline"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                showToggle
                isVisible={isConfirmPasswordVisible}
                onToggleVisibility={() => setIsConfirmPasswordVisible((current) => !current)}
              />
            )}
          </View>

          {!!errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <Pressable
            style={styles.rememberRow}
            onPress={() => setRememberMe((current) => !current)}
          >
            <View style={[styles.rememberBox, rememberMe && styles.rememberBoxActive]}>
              {rememberMe && <Ionicons name="checkmark" size={13} color="#04101B" />}
            </View>
            <Text style={styles.rememberText}>Remember me on this device</Text>
          </Pressable>

          <Pressable
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || !!socialProvider}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#04101B" />
            ) : (
              <Text style={styles.submitButtonText}>{copy.submitLabel}</Text>
            )}
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          <View style={styles.socialRow}>
            <Pressable
              style={[
                styles.socialButton,
                styles.googleButton,
                socialProvider === 'google' && styles.socialButtonBusy,
              ]}
              onPress={() => handleSocialAuth('google')}
              disabled={isSubmitting || !!socialProvider}
            >
              {socialProvider === 'google' ? (
                <ActivityIndicator color="#F8FBFF" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={17} color="#EA4335" />
                  <Text style={styles.socialButtonText}>Google</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.socialButton,
                styles.facebookButton,
                socialProvider === 'facebook' && styles.socialButtonBusy,
              ]}
              onPress={() => handleSocialAuth('facebook')}
              disabled={isSubmitting || !!socialProvider}
            >
              {socialProvider === 'facebook' ? (
                <ActivityIndicator color="#F8FBFF" />
              ) : (
                <>
                  <Ionicons name="logo-facebook" size={17} color="#1877F2" />
                  <Text style={styles.socialButtonText}>Facebook</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchPrompt}>{copy.switchPrompt}</Text>
            <Pressable
              onPress={() => {
                setMode((current) => (current === 'signIn' ? 'signUp' : 'signIn'));
                setErrorMessage('');
              }}
            >
              <Text style={styles.switchLabel}>{copy.switchLabel}</Text>
            </Pressable>
          </View>

          {mode === 'signIn' && (
            <View style={styles.resetRow}>
              <Text style={styles.resetPrompt}>Forgot your password?</Text>
              <Pressable onPress={handleForgotPassword}>
                <Text style={styles.resetLink}>Reset it</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#01030A',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#01030A',
  },
  backgroundTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 4, 12, 0.9)',
  },
  backgroundDepth: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 8, 18, 0.18)',
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
  asteroid: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#CBD5E1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
  content: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'center',
    gap: 18,
  },
  hero: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 0,
  },
  logoHalo: {
    width: 104,
    height: 104,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -2,
  },
  logoHaloRing: {
    position: 'absolute',
    inset: -8,
    borderRadius: 36,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  logoCoreBox: {
    width: 82,
    height: 82,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9, 20, 36, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.16)',
  },
  brand: {
    color: '#F8FBFF',
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: -1,
    textShadowColor: 'rgba(96, 165, 250, 0.42)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  card: {
    borderRadius: 28,
    padding: 16,
    backgroundColor: 'rgba(7, 13, 24, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.09)',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 10,
    gap: 12,
    marginTop: -32,
  },
  signalBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  signalText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  copyBlock: {
    gap: 4,
  },
  title: {
    color: '#F8FBFF',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.7,
    textShadowColor: 'rgba(125, 211, 252, 0.18)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  subtitle: {
    color: 'rgba(190, 206, 228, 0.72)',
    fontSize: 13,
    lineHeight: 18,
  },
  form: {
    gap: 9,
  },
  fieldShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.028)',
    borderWidth: 1,
    borderColor: 'rgba(173,191,218,0.08)',
    overflow: 'hidden',
  },
  fieldIconWrap: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 8,
    color: '#F8FBFF',
    fontSize: 15,
  },
  fieldToggle: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -2,
  },
  rememberBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(173,191,218,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  rememberBoxActive: {
    backgroundColor: '#7DD3FC',
    borderColor: '#7DD3FC',
  },
  rememberText: {
    color: 'rgba(190, 206, 228, 0.72)',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(127,29,29,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(252,165,165,0.12)',
  },
  errorText: {
    flex: 1,
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 15,
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.72,
  },
  submitButtonText: {
    color: '#04101B',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(173,191,218,0.12)',
  },
  orText: {
    color: 'rgba(173,191,218,0.48)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  googleButton: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  facebookButton: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  socialButtonBusy: {
    opacity: 0.8,
  },
  socialButtonText: {
    color: '#F8FBFF',
    fontSize: 13,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 2,
  },
  switchPrompt: {
    color: 'rgba(190,206,228,0.56)',
    fontSize: 13,
  },
  switchLabel: {
    color: '#7DD3FC',
    fontSize: 13,
    fontWeight: '700',
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -2,
  },
  resetPrompt: {
    color: 'rgba(190,206,228,0.48)',
    fontSize: 12.5,
  },
  resetLink: {
    color: '#FCA5A5',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
