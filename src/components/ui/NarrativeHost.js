import React from 'react';
import NarrativeScene from './NarrativeScene';
import { useNarrativeDialogContext } from './NarrativeDialogContext';

/**
 * Overlay hội thoại trong `#peta-body.container_fixed`.
 * Nền trang = container / ec-page-surface; Host chỉ vẽ nhân vật + hộp thoại.
 * Page đăng ký script qua useNarrativeDialog() — không cần chèn NarrativeScene.
 */
function NarrativeHost() {
  const { session } = useNarrativeDialogContext();

  if (!session?.visible) return null;

  return (
    <NarrativeScene
      mode="overlay"
      className={['narrative-scene--host', session.className || ''].join(' ').trim()}
      title={session.title}
      speaker={session.speaker}
      portraitSrc={session.portraitSrc}
      backgroundSrc=""
      useBackground={false}
      lines={session.lines}
      vars={session.vars}
      typingMsPerChar={session.typingMsPerChar}
      scriptKey={session.scriptKey}
      align={session.align}
      portraitFallback={session.portraitFallback}
      emptyText={session.emptyText}
      showActions="never"
      actions={null}
      onScriptComplete={session.onScriptComplete}
      onAdvance={session.onAdvance}
      onSkip={session.onSkip}
    />
  );
}

export default NarrativeHost;
