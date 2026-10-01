import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserContext } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import GameDialogModal from '../ui/GameDialogModal';
import { championFormationId, championNpcInMode, fetchChampionRoster, getChampionFormation, readChampionRoster } from './championNpcs';
import '../css/ArenaPage.css';
import './ChampionChallengePage.css';

const MODE_META = {
  '3v3': {
    id: '3v3',
    title: 'Thách Đấu Elite',
    modeLine: 'Chế Độ 3vs3',
    status: 'Đang mở',
    art: '/images/background/Champion_Background.jpg',
    artPosition: 'center',
  },
  '5v5': {
    id: '5v5',
    title: 'Thách Đấu Champion',
    modeLine: 'Chế Độ 5vs5',
    status: 'Đang mở',
    art: '/images/background/Champion_Background_2.jpg',
    artPosition: 'center bottom',
  },
};

const MODE_ORDER = ['3v3', '5v5'];

function petImg(file) {
  if (!file) return '/images/pets/placeholder.png';
  if (String(file).startsWith('/') || String(file).startsWith('http')) return file;
  return `/images/pets/${file}`;
}

function onPetImgError(event) {
  const img = event.currentTarget;
  img.onerror = null;
  img.src = '/images/background/pokeball-logo.svg';
}

/**
 * Giải Vương — chọn hạng 3v3 / 5v5, rồi chọn NPC.
 * Combat local theo đội hình NPC (không gắn Arena boss / Redis).
 */
function ChampionChallengePage() {
  const { user, isLoading } = React.useContext(UserContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [roster, setRoster] = useState(() => readChampionRoster());
  const [errorModal, setErrorModal] = useState('');
  const [starting, setStarting] = useState(false);

  const modeParam = searchParams.get('mode');
  const mode = modeParam === '5v5' ? '5v5' : modeParam === '3v3' ? '3v3' : null;
  const modeMeta = mode ? MODE_META[mode] : null;

  useEffect(() => {
    const refresh = () => setRoster(readChampionRoster());
    const pull = () => {
      fetchChampionRoster({ force: true })
        .then((result) => setRoster(result.roster))
        .catch(() => setRoster(readChampionRoster()));
    };
    window.addEventListener('petaria-champion-roster', refresh);
    window.addEventListener('focus', pull);
    pull();
    return () => {
      window.removeEventListener('petaria-champion-roster', refresh);
      window.removeEventListener('focus', pull);
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) navigate('/login');
  }, [isLoading, user, navigate]);

  const openMode = (nextMode) => {
    navigate(`/battle/champion?mode=${nextMode}`);
  };

  const openSelect = async (npc, battleMode) => {
    if (starting) return;
    setStarting(true);
    setErrorModal('');
    try {
      const fresh = readChampionRoster().find((n) => n.npcId === npc.npcId) || npc;
      const formation = getChampionFormation(fresh, battleMode);
      if (!formation.length) {
        setErrorModal('NPC này chưa có đội hình cho chế độ này.');
        return;
      }

      navigate('/battle/arena/select', {
        state: {
          enemy: {
            id: `champion-${npc.npcId}`,
            name: fresh.name,
            image: fresh.portrait,
            level: Number(fresh.level) || 1,
            isBoss: false,
            isChampionNpc: true,
            championNpcId: fresh.npcId,
            final_stats: { hp: 1, str: 1, def: 1, spd: 1 },
            current_hp: 1,
          },
          enemyFormation: formation,
          enemyFormationId: championFormationId(fresh, battleMode),
          formationId: battleMode === '3v3' ? '2-1' : '3-2',
          battleMode,
          battleSource: 'champion',
          returnPath: `/battle/champion?mode=${battleMode}`,
        },
      });
    } catch (err) {
      setErrorModal(err.message || 'Không mở được màn chọn đội hình.');
    } finally {
      setStarting(false);
    }
  };

  if (isLoading) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="arena-page-container">
          <div className="loading">Đang tải...</div>
        </div>
      </TemplatePage>
    );
  }

  if (!user) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="arena-page-container">
          <div className="error">Vui lòng đăng nhập</div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="arena-page-container champion-page">
        {modeMeta ? (
          <NpcList
            roster={roster}
            modeMeta={modeMeta}
            starting={starting}
            onBack={() => navigate('/battle/champion')}
            onFight={(npc) => openSelect(npc, modeMeta.id)}
          />
        ) : (
          <ModeHub onOpen={openMode} onBack={() => navigate('/battle')} />
        )}

        <GameDialogModal
          isOpen={Boolean(errorModal)}
          mode="alert"
          tone="error"
          title="Không thể bắt đầu"
          onClose={() => setErrorModal('')}
          confirmLabel="Đóng"
        >
          <p>{errorModal}</p>
        </GameDialogModal>
      </div>
    </TemplatePage>
  );
}

function ModeHub({ onOpen, onBack }) {
  return (
    <>
      <div className="gv-list-head">
        <button type="button" className="gv-list-back" onClick={onBack}>
          Quay lại
        </button>
      </div>
      <div className="gv-modes">
        {MODE_ORDER.map((id) => {
          const meta = MODE_META[id];
          return (
            <button
              key={id}
              type="button"
              className={`gv-banner gv-banner--${id}`}
              onClick={() => onOpen(id)}
            >
              <span
                className="gv-banner__art"
                style={{
                  backgroundImage: `url(${meta.art})`,
                  backgroundPosition: meta.artPosition,
                }}
              />
              <span className="gv-banner__copy">
                <span className="gv-banner__title">
                  {meta.title}
                  <span className="gv-banner__mode">{meta.modeLine}</span>
                </span>
              </span>
              <span className="gv-banner__status">{meta.status}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function NpcPets({ pets, label }) {
  const rowRef = React.useRef(null);
  const [wrapped, setWrapped] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return undefined;

    const measure = () => {
      const kids = el.children;
      if (kids.length < 2) {
        setWrapped(false);
        return;
      }
      const top = kids[0].offsetTop;
      let didWrap = false;
      for (let i = 1; i < kids.length; i += 1) {
        if (kids[i].offsetTop > top + 1) {
          didWrap = true;
          break;
        }
      }
      setWrapped((prev) => (prev === didWrap ? prev : didWrap));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pets]);

  return (
    <div
      ref={rowRef}
      className={`gv-npc__pets${pets.length === 5 ? ' gv-npc__pets--five' : ''}${wrapped ? ' gv-npc__pets--wrapped' : ''}`}
      aria-label={label}
    >
      {pets.map((pet) => (
        <div key={pet.slotKey} className="gv-mini-pet" title={`${pet.name} Lv.${pet.level}`}>
          <img src={petImg(pet.image)} alt={pet.name} draggable={false} onError={onPetImgError} />
          <span>{pet.name}</span>
        </div>
      ))}
    </div>
  );
}

function NpcList({ roster, modeMeta, starting, onBack, onFight }) {
  const npcs = roster.filter((npc) => championNpcInMode(npc, modeMeta.id)).sort((a, b) => a.level - b.level);

  return (
    <>
      <div className="gv-list-head">
        <button type="button" className="gv-list-back" onClick={onBack}>
          Hạng đấu
        </button>
        <p className="gv-list-head__hint">
          {modeMeta.modeLine} · chọn nhà vô địch để vào chọn đội
        </p>
      </div>

      <div className="gv-npc-list">
        {npcs.map((npc) => {
          const preview = getChampionFormation(npc, modeMeta.id);
          const cover = /\.jpe?g$/i.test(npc.portrait);
          return (
            <article key={npc.npcId} className={`gv-npc gv-npc--${npc.element} gv-npc--poster-pets${cover ? ' gv-npc--cover' : ''}`}>
              <img
                src={npc.portrait}
                alt={npc.name}
                className="gv-npc__portrait"
                draggable={false}
              />
              <div className="gv-npc__body gv-npc__body--inline-pets">
                <div className="gv-npc__heading gv-npc__heading--classic">
                  <h2 className="gv-npc__name">{npc.name}</h2>
                  <p className="gv-npc__meta">
                    Lv.{npc.level}
                    <span className="gv-npc__element">{npc.elementLabel}</span>
                  </p>
                  <p className="gv-npc__desc">{npc.description}</p>
                </div>

                <div className="gv-npc__poster-main">
                  <div className="gv-npc__heading gv-npc__heading--poster">
                    <h2 className="gv-npc__name">{npc.name}</h2>
                    <p className="gv-npc__meta">Rcmd Lv.{npc.level}</p>
                  </div>
                  <NpcPets pets={preview} label={`Đội ${modeMeta.badge}`} />
                </div>

                <button
                  type="button"
                  className="arena-card-challenge gv-npc__fight"
                  disabled={starting}
                  onClick={() => onFight(npc)}
                >
                  Thách đấu
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

export default ChampionChallengePage;
