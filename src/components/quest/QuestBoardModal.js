import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useChapter0 } from '../story/Chapter0/Chapter0Context';
import {
  DAILY_QUESTS,
  QUEST_TYPES,
  WEEKLY_QUESTS,
  dailyScore,
  mainQuestsFromFlags,
} from './questCatalog';
import './QuestBoardModal.css';

function progressLabel(quest) {
  return `${quest.progress}/${quest.total}`;
}

function isQuestDone(quest) {
  return quest.progress >= quest.total || quest.done;
}

function sortOpenFirst(list) {
  return [...list].sort((a, b) => Number(isQuestDone(a)) - Number(isQuestDone(b)));
}

function QuestRow({ quest, onOpen }) {
  const done = isQuestDone(quest);
  return (
    <button type="button" className={`quest-row${done ? ' is-done' : ''}`} onClick={() => onOpen(quest)}>
      <span className="quest-row__inner">
        <span className="quest-row__copy">
          <span className="quest-row__title">{quest.title}</span>
          <span className="quest-row__goal">{quest.goal}</span>
          <span className="quest-row__chips">
            {quest.points ? <span className="quest-row__points">+{quest.points}</span> : null}
            {(quest.rewards || []).slice(0, 2).map((reward) => (
              <span key={reward} className="quest-row__chip">{reward}</span>
            ))}
          </span>
        </span>
        <span className={`quest-row__count${done ? ' is-done' : ''}`}>
          {done ? 'Xong' : progressLabel(quest)}
        </span>
      </span>
    </button>
  );
}

function DailyTrack({ score }) {
  const width = Math.max(0, Math.min(100, (score.points / score.goal) * 100));
  return (
    <div className="quest-daily">
      <div className="quest-daily__head">
        <p>Làm {score.enough} trên {score.total} việc là đủ nhận quà.</p>
        <strong>{score.points}/{score.goal}</strong>
      </div>
      <div className="quest-daily__track" aria-hidden>
        <span style={{ width: `${width}%` }} />
        <i className={score.ready ? 'is-ready' : ''} title="Rương ngày">Quà</i>
      </div>
      <p className="quest-daily__note">
        {score.done}/{score.total} việc · mỗi việc 20 điểm · mốc quà là {score.goal} điểm
      </p>
    </div>
  );
}

function QuestDetail({ quest, onBack, onGo }) {
  const done = quest.progress >= quest.total || quest.done;
  return (
    <div className="quest-detail">
      <div className="quest-detail__body">
        <button type="button" className="quest-detail__back" onClick={onBack}>
          ← Danh sách
        </button>
        <h3>{quest.title}</h3>
        <p className="quest-detail__label">Chi tiết</p>
        <p className="quest-detail__text">{quest.detail}</p>
        <p className="quest-detail__label">Mục tiêu</p>
        <p className="quest-detail__goal">
          <span>{quest.goal}</span>
          <strong>{progressLabel(quest)}</strong>
        </p>
      </div>
      <footer className="quest-detail__footer">
        <p className="quest-detail__label">Phần thưởng</p>
        <ul className="quest-detail__rewards">
          {(quest.rewards || []).map((reward) => (
            <li key={reward}>{reward}</li>
          ))}
        </ul>
        {quest.route && !done ? (
          <button type="button" className="quest-detail__go" onClick={() => onGo(quest)}>
            Đi
          </button>
        ) : (
          <div className={`quest-detail__status${done ? ' is-done' : ''}`} role="status">
            <span className="quest-detail__status-mark" aria-hidden>{done ? '✓' : '•'}</span>
            <span>{done ? 'Đã xong' : 'Làm ngay trong Kinh Đô'}</span>
          </div>
        )}
      </footer>
    </div>
  );
}

export default function QuestBoardModal() {
  const { story, questBoardOpen, questFocusId, closeQuestBoard } = useChapter0();
  const navigate = useNavigate();
  const [tab, setTab] = useState('main');
  const [selected, setSelected] = useState(null);
  const flags = story?.flags || {};
  const mains = useMemo(() => mainQuestsFromFlags(flags), [flags]);
  const score = useMemo(() => dailyScore(DAILY_QUESTS), []);
  const lists = { main: mains, daily: DAILY_QUESTS, weekly: WEEKLY_QUESTS };
  const intro = Boolean(story?.quest?.introPending);

  useEffect(() => {
    if (!questBoardOpen) return undefined;
    setTab('main');
    const focus = questFocusId
      ? mainQuestsFromFlags(flags).find((quest) => quest.id === questFocusId)
      : null;
    setSelected(focus || null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') closeQuestBoard();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [questBoardOpen, questFocusId, closeQuestBoard, flags]);

  if (!questBoardOpen) return null;

  const go = (quest) => {
    closeQuestBoard();
    if (quest.route) navigate(quest.route);
  };

  return createPortal(
    <div className="quest-board-overlay" onClick={closeQuestBoard} role="presentation">
      <div
        className="quest-board"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-board-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="quest-board__header">
          <h2 id="quest-board-title">Bảng nhiệm vụ</h2>
          <button type="button" className="quest-board__close" onClick={closeQuestBoard} aria-label="Đóng">
            ×
          </button>
        </header>
        {intro && !selected ? (
          <p className="quest-board__intro">
            {flags.LETTER_QUEST_ACCEPTED
              ? 'Đây là bảng nhiệm vụ. Bấm từng dòng để xem chi tiết. Tắt bảng khi xem xong — nhiệm vụ chính sẽ nằm phía trên ô chat, rồi cậu xuống bến tàu.'
              : 'Đây là bảng nhiệm vụ. Nhiệm vụ chính đang là đến Bưu Điện gặp Rowan. Xem xong cậu đi đâu cũng được, không cần vào bưu điện ngay.'}
          </p>
        ) : null}
        {selected ? (
          <QuestDetail quest={selected} onBack={() => setSelected(null)} onGo={go} />
        ) : (
          <>
            <div className="quest-board__tabs" role="tablist">
              {QUEST_TYPES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={tab === item.id ? 'is-active' : ''}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {tab === 'daily' ? <DailyTrack score={score} /> : null}
            {tab === 'weekly' ? (
              <p className="quest-board__hint">Nhiệm vụ tuần tính cả tuần. Làm dần, không cần xong trong một ngày.</p>
            ) : null}
            <div className="quest-board__list">
              {sortOpenFirst(lists[tab]).map((quest) => (
                <QuestRow key={quest.id} quest={quest} onOpen={setSelected} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
