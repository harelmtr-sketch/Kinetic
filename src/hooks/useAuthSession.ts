import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  clearStoredSession,
  handleAuthRedirect,
  isAuthCallbackUrl,
  isRefreshTokenError,
} from '../services/authService';
import { ensureStarterData, loadUserData } from '../services/progressService';

const DEFAULT_USER_DATA = {
  profile: null,
  progress: { xp: 0, level: 1 },
  unlockedNodes: [],
};

export function useAuthSession() {
  const requestIdRef = useRef(0);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(DEFAULT_USER_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [authError, setAuthError] = useState(null);

  const hydrateUserData = useCallback(async (nextUser) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!nextUser?.id) {
      setUserData(DEFAULT_USER_DATA);
      return DEFAULT_USER_DATA;
    }

    await ensureStarterData(nextUser);
    const nextUserData = await loadUserData(nextUser.id);

    if (requestId === requestIdRef.current) {
      setUserData(nextUserData);
    }

    return nextUserData;
  }, []);

  const applySession = useCallback(async (nextSession) => {
    setSession(nextSession ?? null);

    const nextUser = nextSession?.user ?? null;
    setUser(nextUser);

    if (!nextUser) {
      requestIdRef.current += 1;
      setUserData(DEFAULT_USER_DATA);
      return DEFAULT_USER_DATA;
    }

    return hydrateUserData(nextUser);
  }, [hydrateUserData]);

  const recoverInvalidSession = useCallback(async (error) => {
    if (!isRefreshTokenError(error)) {
      return false;
    }

    await clearStoredSession();
    await applySession(null);
    return true;
  }, [applySession]);

  useEffect(() => {
    let isMounted = true;

    const syncSessionFromClient = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (await recoverInvalidSession(error)) {
          return;
        }

        throw error;
      }

      if (isMounted) {
        await applySession(data.session ?? null);
      }
    };

    const bootstrap = async () => {
      setIsLoading(true);
      setAuthError(null);

      try {
        const initialUrl = await Linking.getInitialURL();
        if (isAuthCallbackUrl(initialUrl)) {
          await handleAuthRedirect(initialUrl);
        }

        await syncSessionFromClient();
      } catch (error) {
        if (await recoverInvalidSession(error)) {
          return;
        }

        if (isMounted) {
          setAuthError(error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setIsLoading(true);
      setAuthError(null);

      void (async () => {
        try {
          await applySession(nextSession ?? null);
        } catch (error) {
          if (await recoverInvalidSession(error)) {
            return;
          }

          if (isMounted) {
            setAuthError(error);
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      })();
    });

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      if (!isMounted || !isAuthCallbackUrl(url)) {
        return;
      }

      setIsLoading(true);
      setAuthError(null);

      void (async () => {
        try {
          await handleAuthRedirect(url);
          await syncSessionFromClient();
        } catch (error) {
          if (await recoverInvalidSession(error)) {
            return;
          }

          if (isMounted) {
            setAuthError(error);
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      })();
    });

    return () => {
      isMounted = false;
      requestIdRef.current += 1;
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, [applySession, recoverInvalidSession]);

  const refreshUserData = useCallback(async () => {
    if (!user?.id) {
      return DEFAULT_USER_DATA;
    }

    setIsRefreshing(true);
    setAuthError(null);

    try {
      return await hydrateUserData(user);
    } catch (error) {
      setAuthError(error);
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, [hydrateUserData, user]);

  return {
    session,
    user,
    userData,
    setUserData,
    isLoading,
    isRefreshing,
    authError,
    refreshUserData,
  };
}
