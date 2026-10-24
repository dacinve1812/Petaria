import React, { useEffect, useState } from 'react';
import { useChapter0 } from '../story/Chapter0/Chapter0Context';
import { currentMainQuests } from './questCatalog';
import './QuestTracker.css';

const STORAGE_KEY = 'petaria-quest-tracker-collapsed';

export default function QuestTracker() {
  const { story, openQuestBoard } = useChapter0();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const visible = Boolean(story?.quest?.tracker);
  const quests = currentMainQuests(story?.flags || {});

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  if (!visible) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        className="quest-tracker__tab"
        aria-label="Hiện nhiệm vụ"
        onClick={() => setCollapsed(false)}
      >
        {'<'}
      </button>
    );
  }

  return (
    <section className="quest-tracker" aria-label="Nhiệm vụ chính">
      <div className="quest-tracker__list">
        {quests.map((quest) => (
          <div key={quest.id} className="quest-tracker__item">
            <span className="quest-tracker__mark" aria-hidden />
            <button
              type="button"
              className="quest-tracker__open-btn"
              onClick={() => openQuestBoard(quest.id)}
            >
              <span className="quest-tracker__copy">
                <strong>{quest.title}</strong>
                <span>
                  {quest.goal}{' '}
                  <b>
                    {quest.progress}/{quest.total}
                  </b>
                </span>
              </span>
            </button>
            <button
              type="button"
              className="quest-tracker__collapse"
              aria-label="Ẩn nhiệm vụ"
              onClick={() => setCollapsed(true)}
            >
              {'<'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
