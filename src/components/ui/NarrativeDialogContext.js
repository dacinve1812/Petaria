import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';

const NarrativeDialogContext = createContext(null);

/**
 * Provider — gắn gần `#peta-body` / MainLayout.
 * Page gọi useNarrativeDialog() để đẩy script; Host render overlay.
 */
export function NarrativeDialogProvider({ children }) {
  const location = useLocation();
  const [session, setSessionState] = useState(null);
  const ownerRef = useRef(null);

  const clear = useCallback((ownerId) => {
    if (ownerId != null && ownerRef.current !== ownerId) return;
    ownerRef.current = null;
    setSessionState(null);
  }, []);

  const setSession = useCallback((next, ownerId = 'default') => {
    if (next == null) {
      clear(ownerId);
      return;
    }
    ownerRef.current = ownerId;
    setSessionState({
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      visible: true,
      ...next,
    });
  }, [clear]);

  // Đổi route → tắt overlay (tránh dialog trang cũ)
  useEffect(() => {
    ownerRef.current = null;
    setSessionState(null);
  }, [location.pathname]);

  const value = useMemo(
    () => ({
      session,
      setSession,
      clear,
    }),
    [session, setSession, clear],
  );

  return (
    <NarrativeDialogContext.Provider value={value}>{children}</NarrativeDialogContext.Provider>
  );
}

export function useNarrativeDialogContext() {
  const ctx = useContext(NarrativeDialogContext);
  if (!ctx) {
    throw new Error('useNarrativeDialogContext must be used within NarrativeDialogProvider');
  }
  return ctx;
}

/**
 * Page đăng ký hội thoại theo path — không cần render <NarrativeScene />.
 * props: visible, title, speaker, portraitSrc, lines, vars, scriptKey, typingMsPerChar, align, …
 */
export function useNarrativeDialog(props) {
  const { setSession, clear } = useNarrativeDialogContext();
  const ownerId = useRef(`ns-${Math.random().toString(36).slice(2, 9)}`).current;
  const {
    visible = true,
    title,
    speaker,
    portraitSrc,
    lines,
    vars,
    typingMsPerChar,
    scriptKey,
    align,
    portraitFallback,
    emptyText,
    className,
    onScriptComplete,
    onAdvance,
    onSkip,
  } = props || {};

  const callbacksRef = useRef({});
  callbacksRef.current = { onScriptComplete, onAdvance, onSkip };

  useEffect(() => {
    if (!visible) {
      clear(ownerId);
      return undefined;
    }
    setSession(
      {
        visible: true,
        title,
        speaker,
        portraitSrc,
        backgroundSrc: '',
        useBackground: false,
        lines,
        vars,
        typingMsPerChar,
        scriptKey,
        align,
        portraitFallback,
        emptyText,
        className,
        onScriptComplete: (...args) => callbacksRef.current.onScriptComplete?.(...args),
        onAdvance: (...args) => callbacksRef.current.onAdvance?.(...args),
        onSkip: (...args) => callbacksRef.current.onSkip?.(...args),
      },
      ownerId,
    );
    return () => clear(ownerId);
  }, [
    visible,
    title,
    speaker,
    portraitSrc,
    lines,
    vars,
    typingMsPerChar,
    scriptKey,
    align,
    portraitFallback,
    emptyText,
    className,
    setSession,
    clear,
    ownerId,
  ]);
}

export default NarrativeDialogContext;
