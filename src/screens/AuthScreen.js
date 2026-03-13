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
    top: 152, width: 30, height: 14, startX: -72, endX: SCREEN_WIDTH + 42,
    sway: 12, rotateStart: '-16deg', rotateEnd: '12deg',
    color: 'rgba(148, 163, 184, 0.34)', borderColor: 'rgba(226, 232, 240, 0.16)',
    craterColor: 'rgba(71, 85, 105, 0.46)', entry: 0.02, exit: 0.4,
  },
  {
    top: 286, width: 22, height: 11, startX: SCREEN_WIDTH + 36, endX: -64,
    sway: 14, rotateStart: '12deg', rotateEnd: '-18deg',
    color: 'rgba(161, 161, 170, 0.28)', borderColor: 'rgba(228, 228, 231, 0.12)',
    craterColor: 'rgba(82, 82, 91, 0.42)', entry: 0.2, exit: 0.58,
  },
  {
    top: 516, width: 34, height: 16, startX: -88, endX: SCREEN_WIDTH + 60,
    sway: 18, rotateStart: '-10deg', rotateEnd: '18deg',
    color: 'rgba(113, 113, 122, 0.26)', borderColor: 'rgba(212, 212, 216, 0.12)',
    craterColor: 'rgba(63, 63, 70, 0.38)', entry: 0.46, exit: 0.88,
  },
  {
    top: 704, width: 18, height: 10, startX: SCREEN_WIDTH + 28, endX: -54,
    sway: 10, rotateStart: '22deg', rotateEnd: '-14deg',
    color: 'rgba(148, 163, 184, 0.22)', borderColor: 'rgba(226, 232, 240, 0.1)',
    craterColor: 'rgba(71, 85, 105, 0.32)', entry: 0.66, exit: 0.98,
  },
];

function Field({
  icon, placeholder, value, onChangeText,
  secureTextEntry = false, autoComplete, keyboardType,
  showToggle = false, isVisible = false, onToggleVisibility,
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
        const pulse = driftValue.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });

        return (
          <Animated.View
            key={`${rock.top}-${rock.entry}-${index}`}
            style={[styles.asteroid, {
              top: rock.top, width: rock.width, height: rock.height,
              backgroundColor: rock.color, borderColor: rock.borderColor, opacity,
              transform: [{ translateX }, { translateY }, { rotate }, { scale }, { scale: pulse }],
            }]}
          >
            <View style={[styles.asteroidCraterLarge, { backgroundColor: rock.craterColor }]} />
            <View style={[styles.asteroidCraterSmall, { backgroundColor: rock.craterColor }]} />
          </Animated.View>
        );
      })}

      {ALL_STARS.map((star, index) => {
        const translateY = driftValue.interpolate({ inputRange: [0, 1], outputRange: [0, star.drift] });
        const translateX = twinkleValue.interpolate({ inputRange: [0, 1], outputRange: [0, index % 2 === 0 ? 1.5 : -1.5] });
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
            style={[styles.star, {
              left: star.left, top: star.top, width: star.size, height: star.size,
              borderRadius: star.size, backgroundColor: star.color, opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            }]}
          />
        );
      })}
    </View>
  );
}

export default function AuthScreen({ onSkip }) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialProvider, setSocialProvider] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showReset, setShowReset] = useState(false);
  const floatValue = useRef(new Animated.Value(0)).current;
  const twinkleValue = useRef(new Animated.Value(0)).current;
  const rockValue = useRef(new Animated.Value(0)).current;
  const keyboardShift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;
    const restoreSavedLogin = async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_LOGIN_KEY);
        if (!raw || !isMounted) return;
        const savedLogin = JSON.parse(raw);
        setEmail(savedLogin.email || '');
        setPassword(savedLogin.password || '');
      } catch (_error) { /* ignore */ }
    };
    restoreSavedLogin();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(floatValue, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatValue, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const twinkleLoop = Animated.loop(Animated.sequence([
      Animated.timing(twinkleValue, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(twinkleValue, { toValue: 0, duration: 5200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const rockLoop = Animated.loop(Animated.sequence([
      Animated.timing(rockValue, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(rockValue, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    floatLoop.start(); twinkleLoop.start(); rockLoop.start();
    return () => { floatLoop.stop(); twinkleLoop.stop(); rockLoop.stop(); };
  }, [floatValue, twinkleValue, rockValue]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      const keyboardHeight = event.endCoordinates?.height || 0;
      Animated.timing(keyboardShift, {
        toValue: -Math.min(150, Math.max(72, keyboardHeight * 0.32)),
        duration: Platform.OS === 'ios' ? 240 : 180,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(keyboardShift, {
        toValue: 0, duration: Platform.OS === 'ios' ? 220 : 180,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [keyboardShift]);

  const logoTranslateY = floatValue.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const formTranslateY = floatValue.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) { setErrorMessage('Email and password are required.'); return; }
    if (!normalizedEmail.includes('@')) { setErrorMessage('Enter a valid email address.'); return; }
    if (password.length < 6) { setErrorMessage('Password must be at least 6 characters.'); return; }
    if (mode === 'signUp' && password !== confirmPassword) { setErrorMessage('Passwords do not match.'); return; }

    setIsSubmitting(true);
    setErrorMessage('');
    setShowReset(false);

    try {
      if (mode === 'signIn') {
        await signIn(normalizedEmail, password);
        // Prompt to save credentials after successful sign-in
        Alert.alert(
          'Save login?',
          'Would you like to save your credentials for next time?',
          [
            { text: 'Not now', style: 'cancel', onPress: () => AsyncStorage.removeItem(SAVED_LOGIN_KEY) },
            { text: 'Save', onPress: () => AsyncStorage.setItem(SAVED_LOGIN_KEY, JSON.stringify({ email: normalizedEmail, password, remember: true })) },
          ],
        );
      } else {
        const result = await signUp(normalizedEmail, password);
        if (result.user && !result.session) {
          Alert.alert('Check your email', 'Your account was created. Confirm your email, then sign in.');
          setMode('signIn');
        }
      }
    } catch (error) {
      const msg = error?.message || 'Unable to continue right now.';
      setErrorMessage(msg);
      if (mode === 'signIn') setShowReset(true);
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
      Alert.alert('Reset email sent', 'Check your inbox for the password reset link.');
      setShowReset(false);
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to send a reset email right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSignIn = mode === 'signIn';

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

      <View style={[styles.content, { paddingTop: insets.top + 2, paddingBottom: Math.max(insets.bottom, 18) }]}>
        <Animated.View style={[styles.hero, { transform: [{ translateY: Animated.add(logoTranslateY, keyboardShift) }] }]}>
          <View style={styles.logoHalo}>
            <View style={styles.logoHaloRing} />
            <View style={styles.logoCoreBox}>
              <KineticLogo size={44} glow={false} />
            </View>
          </View>
          <Text style={styles.title}>{isSignIn ? 'Sign In' : 'Create Account'}</Text>
        </Animated.View>

        <Animated.View style={[styles.formWrap, { transform: [{ translateY: Animated.add(formTranslateY, keyboardShift) }] }]}>

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
              placeholder={isSignIn ? 'Enter your password' : 'Create a password'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              showToggle
              isVisible={isPasswordVisible}
              onToggleVisibility={() => setIsPasswordVisible((c) => !c)}
            />
            {!isSignIn && (
              <Field
                icon="shield-checkmark-outline"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                showToggle
                isVisible={isConfirmPasswordVisible}
                onToggleVisibility={() => setIsConfirmPasswordVisible((c) => !c)}
              />
            )}
          </View>

          {!!errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {showReset && isSignIn && (
            <Pressable style={styles.resetButton} onPress={handleForgotPassword}>
              <Text style={styles.resetButtonText}>Reset password</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || !!socialProvider}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>{isSignIn ? 'Sign In' : 'Create Account'}</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => { setMode(isSignIn ? 'signUp' : 'signIn'); setErrorMessage(''); setShowReset(false); }}
          >
            <Text style={styles.secondaryButtonText}>
              {isSignIn ? 'Create Account' : 'Back to Sign In'}
            </Text>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          <View style={styles.socialRow}>
            <Pressable
              style={[styles.socialButton, socialProvider === 'google' && styles.socialButtonBusy]}
              onPress={() => handleSocialAuth('google')}
              disabled={isSubmitting || !!socialProvider}
            >
              {socialProvider === 'google' ? <ActivityIndicator color="#F8FBFF" /> : (
                <>
                  <Ionicons name="logo-google" size={17} color="#EA4335" />
                  <Text style={styles.socialButtonText}>Google</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.socialButton, socialProvider === 'facebook' && styles.socialButtonBusy]}
              onPress={() => handleSocialAuth('facebook')}
              disabled={isSubmitting || !!socialProvider}
            >
              {socialProvider === 'facebook' ? <ActivityIndicator color="#F8FBFF" /> : (
                <>
                  <Ionicons name="logo-facebook" size={17} color="#1877F2" />
                  <Text style={styles.socialButtonText}>Facebook</Text>
                </>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#01030A' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#01030A' },
  backgroundTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(1, 4, 12, 0.9)' },
  backgroundDepth: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3, 8, 18, 0.18)' },
  starfield: { ...StyleSheet.absoluteFillObject },
  star: {
    position: 'absolute',
    shadowColor: '#D7ECFF', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95, shadowRadius: 10, elevation: 3,
  },
  asteroid: {
    position: 'absolute', borderRadius: 999, borderWidth: 1,
    shadowColor: '#CBD5E1', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1, shadowRadius: 8,
  },
  asteroidCraterLarge: { position: 'absolute', width: 7, height: 7, borderRadius: 999, top: 3, left: 6, opacity: 0.72 },
  asteroidCraterSmall: { position: 'absolute', width: 4, height: 4, borderRadius: 999, right: 5, bottom: 3, opacity: 0.58 },
  content: { flex: 1, paddingHorizontal: 46, justifyContent: 'center', gap: 20 },
  hero: { alignItems: 'center', gap: 10 },
  logoHalo: { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  logoHaloRing: {
    position: 'absolute', inset: -6, borderRadius: 26,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    shadowColor: '#60A5FA', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  logoCoreBox: {
    width: 62, height: 62, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(9, 20, 36, 0.92)',
    borderWidth: 1, borderColor: 'rgba(125, 211, 252, 0.16)',
  },
  formWrap: { gap: 12 },
  title: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 1.6,
    textAlign: 'center', textTransform: 'uppercase',
  },
  form: { gap: 8 },
  fieldShell: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(173,191,218,0.10)', overflow: 'hidden',
  },
  fieldIconWrap: { width: 42, alignItems: 'center', justifyContent: 'center' },
  fieldInput: { flex: 1, paddingVertical: 13, paddingRight: 8, color: '#F8FBFF', fontSize: 14 },
  fieldToggle: { width: 38, alignItems: 'center', justifyContent: 'center' },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: 'rgba(127,29,29,0.22)',
    borderWidth: 1, borderColor: 'rgba(252,165,165,0.12)',
  },
  errorText: { flex: 1, color: '#FCA5A5', fontSize: 12, lineHeight: 16 },
  resetButton: { alignSelf: 'center', paddingVertical: 3 },
  resetButtonText: { color: '#FCA5A5', fontSize: 12, fontWeight: '600' },
  submitButton: {
    alignItems: 'center', justifyContent: 'center', borderRadius: 14,
    paddingVertical: 14, backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32, shadowRadius: 12, elevation: 6,
  },
  submitButtonDisabled: { opacity: 0.72 },
  submitButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  secondaryButton: {
    alignItems: 'center', justifyContent: 'center', borderRadius: 14,
    paddingVertical: 13, borderWidth: 1,
    borderColor: 'rgba(173,191,218,0.15)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  secondaryButtonText: { color: 'rgba(220, 230, 245, 0.82)', fontSize: 13, fontWeight: '800' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(173,191,218,0.12)' },
  orText: { color: 'rgba(173,191,218,0.48)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.1 },
  socialRow: { flexDirection: 'row', gap: 8 },
  socialButton: {
    flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.035)', borderColor: 'rgba(255,255,255,0.08)',
  },
  socialButtonBusy: { opacity: 0.8 },
  socialButtonText: { color: '#F8FBFF', fontSize: 12, fontWeight: '700' },
});
