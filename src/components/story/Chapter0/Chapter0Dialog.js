import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useChapter0 } from './Chapter0Context';
import chapter0Assets from './chapter0-assets.json';
import OpeningReel from '../ui/OpeningReel';
import StoryTalk from '../ui/StoryTalk';
import GameDialogModal from '../../ui/GameDialogModal';

function screenArt(artKey) {
  const screens = chapter0Assets.screens || {};
  const entry = screens[artKey] || screens[chapter0Assets.fallbackScreen] || '';
  if (!entry || typeof entry === 'string') {
    return { desktop: entry || '', mobile: entry || '' };
  }
  const desktop = entry.desktop || entry.mobile || '';
  return { desktop, mobile: entry.mobile || desktop };
}

function portraitSrc(speakerId) {
  return (chapter0Assets.portraits || {})[speakerId] || '';
}

function currentArt(steps, index, step) {
  if (step?.artKey) return step.artKey;
  for (let i = index; i >= 0; i -= 1) {
    if (steps[i]?.artKey) return steps[i].artKey;
  }
  return 'opening_04_capital';
}

function sceneCast(steps) {
  const cast = [];
  steps.forEach((item) => {
    if (item.speakerId && item.speakerId !== 'NARRATOR' && !cast.includes(item.speakerId)) {
      cast.push(item.speakerId);
    }
  });
  return cast.slice(0, 2);
}

function rewardImage(item) {
  const raw = String(item?.image || '');
  if (!raw) return '';
  if (raw.startsWith('http') || raw.startsWith('/')) return raw;
  const type = String(item?.type || '').toLowerCase();
  const folder = type === 'equipment' || type === 'weapon' ? 'equipments' : 'items';
  return `/images/${folder}/${raw}`;
}

function person(steps, id, speaking) {
  if (!id) return null;
  const src = portraitSrc(id);
  if (!src) return null;
  const name = steps.find((item) => item.speakerId === id)?.speaker || id;
  return { src, name, speaking };
}

function Chapter0Dialog() {
  const { scene, story, postEvent } = useChapter0();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [inserted, setInserted] = useState(null);
  const [choiceId, setChoiceId] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setIndex(0);
    setInserted(null);
    setChoiceId(null);
    setBusy(false);
  }, [scene?.id]);

  const closeGift = async () => {
    try {
      await postEvent({ type: 'REWARDS_ACK' });
    } catch {
      /* the items are already in the bag */
    }
  };

  const rewardList = Array.isArray(story?.rewards) ? story.rewards : [];
  if (rewardList.length) {
    return createPortal(
      <GameDialogModal
        isOpen
        onClose={closeGift}
        title="Quà tân thủ"
        mode="alert"
        tone="success"
        confirmLabel="Nhận"
        onConfirm={closeGift}
      >
        <p>Bạn nhận được:</p>
        <ul className="ch0-gift-list">
          {rewardList.map((item, index) => {
            const row = typeof item === 'string' ? { name: item, image: '' } : item;
            const src = rewardImage(row);
            return (
              <li key={`${row.name}-${index}`}>
                {src ? <img src={src} alt="" /> : null}
                <span>{row.name}</span>
              </li>
            );
          })}
        </ul>
      </GameDialogModal>,
      document.body
    );
  }

  if (!scene) return null;
  const steps = scene.steps || [];
  const step = inserted || steps[index] || null;
  if (!step) return null;

  const finishSeen = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await postEvent({ type: 'SCENE_SEEN', sceneId: scene.id });
    } finally {
      setBusy(false);
    }
  };

  const acceptOrSnoozeLetter = async () => {
    setBusy(true);
    try {
      if (choiceId === 'YES') await postEvent({ type: 'LETTER_ACCEPT' });
      else await postEvent({ type: 'LETTER_DECLINE' });
    } finally {
      setBusy(false);
    }
  };

  const goNext = async () => {
    if (!inserted && step?.type === 'action' && step.action === 'OFFER_SERVER_QUEST_ACCEPT') {
      await acceptOrSnoozeLetter();
      return;
    }
    if (inserted) {
      const upcoming = steps[index + 1];
      setInserted(null);
      if (upcoming?.type === 'action' && upcoming.action === 'OFFER_SERVER_QUEST_ACCEPT') {
        await acceptOrSnoozeLetter();
        return;
      }
      setIndex((value) => value + 1);
      return;
    }
    const next = steps[index + 1];
    if (!next) {
      await finishSeen();
      return;
    }
    if (next.type === 'action' && next.action === 'OFFER_SERVER_QUEST_ACCEPT') {
      await acceptOrSnoozeLetter();
      return;
    }
    if (next.type === 'action' && next.action === 'OPEN_TUTORIAL_SUPPLIES_CLAIM') {
      setIndex((value) => value + 1);
      return;
    }
    if (next.type === 'action' && next.action === 'OPEN_WORLD_MAP') {
      setIndex((value) => value + 1);
      return;
    }
    if (next.type === 'action') {
      await finishSeen();
      return;
    }
    setIndex((value) => value + 1);
  };

  const choose = async (option) => {
    setChoiceId(option.id);
    setBusy(true);
    try {
      await postEvent({ type: 'CHOICE', sceneId: scene.id, choiceId: option.id });
    } catch {
      /* choice is flavor except the letter, which is confirmed on the next step */
    } finally {
      setBusy(false);
    }
    setInserted({
      type: 'line',
      speakerId: steps[index]?.speakerId || steps[index - 1]?.speakerId || '',
      speaker: steps[index - 1]?.speaker || steps[index]?.speaker || '',
      text: option.response,
    });
  };

  const claimSupplies = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await postEvent({ type: 'STARTER_SUPPLIES_CLAIMED' });
    } finally {
      setBusy(false);
    }
  };

  const openWorld = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await postEvent({ type: 'SCENE_SEEN', sceneId: scene.id });
      navigate('/world-map');
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    if (!scene.questId || busy) return;
    setBusy(true);
    try {
      await postEvent({ type: 'DISMISS_QUEST', questId: scene.questId });
    } finally {
      setBusy(false);
    }
  };

  if (scene.presentation === 'cinematic' && (step.type === 'line' || step.type === 'card')) {
    const art = screenArt(currentArt(steps, index, step));
    return (
      <OpeningReel
        imageSrc={art.desktop}
        mobileImageSrc={art.mobile}
        stepKey={`${scene.id}-${index}`}
        line={step.type === 'line' ? step.text : ''}
        title={step.type === 'card' ? step.title : ''}
        subtitle={step.type === 'card' ? step.subtitle : ''}
        onAdvance={goNext}
        onSkip={scene.skippable ? finishSeen : null}
      />
    );
  }

  const cast = sceneCast(steps);
  const speakerId = step.speakerId || '';
  const leftId = cast.length > 1 ? cast[0] : null;
  const rightId = cast.length > 1 ? cast[1] : (cast[0] || null);
  const line = step.type === 'card'
    ? `${step.title}${step.subtitle ? ` — ${step.subtitle}` : ''}`
    : (step.type === 'line' ? step.text : '');
  let actionLabel = '';
  let onAction = null;
  if (step.type === 'action' && step.action === 'OPEN_TUTORIAL_SUPPLIES_CLAIM') {
    actionLabel = 'Nhận gói hỗ trợ';
    onAction = claimSupplies;
  }
  if (step.type === 'action' && step.action === 'OPEN_WORLD_MAP') {
    actionLabel = 'Mở bản đồ thế giới';
    onAction = openWorld;
  }

  return (
    <StoryTalk
      left={person(steps, leftId, leftId === speakerId)}
      right={person(steps, rightId, rightId === speakerId)}
      line={line}
      onAdvance={goNext}
      prompt={step.type === 'choice' ? step.prompt : ''}
      choices={step.type === 'choice' ? step.options : []}
      onChoose={choose}
      actionLabel={actionLabel}
      onAction={onAction}
      onSkip={scene.skippable ? finishSeen : null}
      onDismiss={scene.dismissible ? dismiss : null}
      blocking={!scene.skippable && !scene.dismissible}
    />
  );
}

export default Chapter0Dialog;
