import { Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { ensureStarterData } from './progressService';

const normalizeEmail = (email) => email.trim().toLowerCase();
export const AUTH_CALLBACK_URL = 'kinetic://auth/callback';
const AUTH_CALLBACK_SCHEME = 'kinetic:';

export function isRefreshTokenError(error) {
  const message = error?.message || error?.error_description || error?.error || '';
  const normalizedMessage = String(message).toLowerCase();

  return normalizedMessage.includes('invalid refresh token')
    || normalizedMessage.includes('refresh token not found')
    || normalizedMessage.includes('refresh_token_not_found');
}

export async function clearStoredSession() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });

  if (error) {
    throw error;
  }
}

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function normalizePath(pathname) {
  if (!pathname) {
    return '';
  }

  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

function normalizeOtpType(type) {
  switch (type) {
    case 'signup':
    case 'invite':
    case 'magiclink':
    case 'recovery':
    case 'email_change':
    case 'email':
    case 'sms':
    case 'phone_change':
      return type;
    default:
      return null;
  }
}

export function isAuthCallbackUrl(url) {
  if (typeof url !== 'string' || !url) {
    return false;
  }

  const parsedUrl = parseUrl(url);
  if (!parsedUrl || parsedUrl.protocol !== AUTH_CALLBACK_SCHEME) {
    return false;
  }

  const normalizedPath = normalizePath(parsedUrl.pathname);

  return (
    (parsedUrl.host === 'auth' && normalizedPath === '/callback')
    || normalizedPath === '/auth/callback'
  );
}

function extractAuthParams(url) {
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    throw new Error('Invalid authentication callback URL.');
  }

  const queryParams = new URLSearchParams(parsedUrl.search);
  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));

  return {
    accessToken: queryParams.get('access_token') || hashParams.get('access_token'),
    refreshToken: queryParams.get('refresh_token') || hashParams.get('refresh_token'),
    code: queryParams.get('code') || hashParams.get('code'),
    tokenHash: queryParams.get('token_hash') || hashParams.get('token_hash'),
    type: queryParams.get('type') || hashParams.get('type'),
    errorCode: queryParams.get('error_code') || hashParams.get('error_code'),
    errorDescription: queryParams.get('error_description') || hashParams.get('error_description'),
  };
}

export async function handleAuthRedirect(url) {
  if (!isAuthCallbackUrl(url)) {
    return null;
  }

  const {
    accessToken,
    refreshToken,
    code,
    tokenHash,
    type,
    errorCode,
    errorDescription,
  } = extractAuthParams(url);

  if (errorCode) {
    throw new Error(errorDescription || errorCode);
  }

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      await ensureStarterData(data.user);
    }

    return data;
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    if (data.user) {
      await ensureStarterData(data.user);
    }

    return data;
  }

  const otpType = normalizeOtpType(type);

  if (tokenHash && otpType) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      await ensureStarterData(data.user);
    }

    return data;
  }

  return null;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: {
      emailRedirectTo: AUTH_CALLBACK_URL,
    },
  });

  if (error) {
    throw error;
  }

  if (data.user) {
    try {
      await ensureStarterData(data.user);
    } catch (starterError) {
      if (data.session) {
        throw starterError;
      }
    }
  }

  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });

  if (error) {
    throw error;
  }

  if (data.user) {
    await ensureStarterData(data.user);
  }

  return data;
}

export async function signInWithSocial(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: AUTH_CALLBACK_URL,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error('OAuth sign-in URL was not generated.');
  }

  const canOpen = await Linking.canOpenURL(data.url);
  if (!canOpen) {
    throw new Error('Unable to open the social sign-in page.');
  }

  await Linking.openURL(data.url);
  return null;
}

export async function sendPasswordReset(email) {
  const normalizedEmail = normalizeEmail(email);
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: AUTH_CALLBACK_URL,
  });

  if (error) {
    throw error;
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    if (isRefreshTokenError(error)) {
      await clearStoredSession();
      return;
    }

    throw error;
  }
}
