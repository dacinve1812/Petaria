import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '../UserContext';
import { getDisplayName } from '../utils/userDisplay';
import { initializeRealtimeSocket } from '../realtime/socketClient';
import './GlobalChatBox.css';

const FALLBACK_AVATAR = '/images/character/knight_warrior.jpg';
const CHAT_TOGGLE_ICON = '/images/ui/chat-toggle-icon.png';
const CHAT_TABS = [
  { id: 'world', label: 'World' },
  { id: 'guild', label: 'Guild' },
  { id: 'system', label: 'System' },
];
const EMOJIS = ['😀', '😄', '😂', '😍', '😎', '🤔', '😢', '😡', '👍', '👎', '🙏', '🔥', '💎', '🎉', '🐾'];

function GlobalChatBox() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const { user, isAuthenticated } = useUser();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('world');
  const [messagesByTab, setMessagesByTab] = useState({
    world: [],
    guild: [],
    system: [],
  });
  const [text, setText] = useState('');
  const [guildName, setGuildName] = useState('');
  const [guildUnavailable, setGuildUnavailable] = useState(false);
  const [toggleIconError, setToggleIconError] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [chatCooldownSeconds, setChatCooldownSeconds] = useState(30);
  const [messageMaxLength, setMessageMaxLength] = useState(150);
  const [remainingCooldown, setRemainingCooldown] = useState(0);
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const visibleMessages = useMemo(
    () => messagesByTab[activeTab] || [],
    [activeTab, messagesByTab]
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.token) return;
    let active = true;

    const loadTabHistory = async (tabId, endpoint) => {
      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) {
          if (tabId === 'guild' && response.status === 403 && data?.requiresGuild) {
            setGuildUnavailable(true);
            setGuildName('');
            setMessagesByTab((prev) => ({ ...prev, guild: [] }));
            return;
          }
          return;
        }
        if (tabId === 'guild') {
          setGuildUnavailable(false);
          setGuildName(String(data?.guild || ''));
        }
        if (typeof data?.cooldownSeconds === 'number') {
          setChatCooldownSeconds(Number(data.cooldownSeconds || 30));
        }
        if (typeof data?.maxMessageLength === 'number') {
          setMessageMaxLength(Number(data.maxMessageLength || 150));
        }
        setMessagesByTab((prev) => ({
          ...prev,
          [tabId]: Array.isArray(data?.messages) ? data.messages : [],
        }));
      } catch (_) {
        if (tabId === 'guild' && active) setGuildUnavailable(true);
      }
    };

    loadTabHistory('world', '/api/chat/world?limit=100');
    loadTabHistory('guild', '/api/chat/guild?limit=100');
    loadTabHistory('system', '/api/chat/system?limit=100');

    return () => {
      active = false;
    };
  }, [API_BASE_URL, isAuthenticated, user?.token]);

  useEffect(() => {
    if (!isAuthenticated || !user?.token) return undefined;
    const socket = initializeRealtimeSocket(API_BASE_URL, user.token);
    if (!socket) return undefined;

    const onChatConfig = (payload = {}) => {
      setChatCooldownSeconds(Number(payload.cooldownSeconds || 30));
      if (typeof payload.maxMessageLength === 'number') {
        setMessageMaxLength(Number(payload.maxMessageLength || 150));
      }
    };

    const onChatMessage = (payload) => {
      if (!payload) return;
      const channel = String(payload.channel || 'world').toLowerCase();
      if (!['world', 'guild'].includes(channel)) return;
      setMessagesByTab((prev) => ({
        ...prev,
        [channel]: [...(prev[channel] || []).slice(-149), payload],
      }));
    };

    const onSystemEvent = (payload = {}) => {
      if (!payload?.message) return;
      const mapped = {
        id: payload.id || `system-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        channel: 'system',
        message: payload.message,
        created_at: payload.created_at || new Date().toISOString(),
        type: payload.type || 'system',
        payload: payload.payload || null,
      };
      setMessagesByTab((prev) => ({
        ...prev,
        system: [...(prev.system || []).slice(-149), mapped],
      }));
    };

    const onChatError = (payload = {}) => {
      if (payload.code === 'CHAT_COOLDOWN') {
        setRemainingCooldown(Number(payload.retryAfterSeconds || 0));
      } else if (payload.message) {
        setError(String(payload.message));
      }
    };

    socket.on('chat:config', onChatConfig);
    socket.on('chat:message', onChatMessage);
    socket.on('system:event', onSystemEvent);
    socket.on('chat:error', onChatError);

    return () => {
      socket.off('chat:config', onChatConfig);
      socket.off('chat:message', onChatMessage);
      socket.off('system:event', onSystemEvent);
      socket.off('chat:error', onChatError);
    };
  }, [API_BASE_URL, isAuthenticated, user?.token]);

  useEffect(() => {
    if (!remainingCooldown) return undefined;
    const timer = window.setInterval(() => {
      setRemainingCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remainingCooldown]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [visibleMessages, isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsEmojiOpen(false);
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    setIsEmojiOpen(false);
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsEmojiOpen(false);
        setIsOpen(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const handleSend = () => {
    if (!user?.token) return;
    const socket = initializeRealtimeSocket(API_BASE_URL, user.token);
    if (!socket) return;
    if (activeTab === 'system') return;
    if (activeTab === 'guild' && guildUnavailable) return;
    if (remainingCooldown > 0) return;
    const value = String(text || '').trim();
    if (!value) return;
    socket.emit('chat:send', { channel: activeTab, message: value });
    setText('');
    setIsEmojiOpen(false);
    setError('');
    setRemainingCooldown(chatCooldownSeconds);
  };

  const handlePickEmoji = (emoji) => {
    setText((prev) => `${prev}${emoji}`);
    if (inputRef.current) inputRef.current.focus();
  };

  const formatMessageTime = (rawTime) => {
    if (!rawTime) return '';
    const date = new Date(rawTime);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDateKey = (rawTime) => {
    if (!rawTime) return '';
    const date = new Date(rawTime);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const formatDateDivider = (rawTime) => {
    if (!rawTime) return '';
    const date = new Date(rawTime);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!isAuthenticated || !user?.token) return null;

  return (
    <div ref={rootRef} className={`global-chat-box ${isOpen ? 'open' : ''}`}>
      {!isOpen ? (
        <button
          type="button"
          className="global-chat-toggle"
          onClick={() => setIsOpen(true)}
          aria-label="Mở Chat"
        >
          {!toggleIconError ? (
            <img
              src={CHAT_TOGGLE_ICON}
              alt="Chat"
              onError={() => setToggleIconError(true)}
            />
          ) : (
            <span className="global-chat-toggle-fallback">💬</span>
          )}
        </button>
      ) : null}

      {isOpen && (
        <div className="global-chat-panel">
          <div className="global-chat-header">
            <div className="global-chat-tabs">
              {CHAT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={activeTab === tab.id ? 'active' : ''}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsEmojiOpen(false);
                    setError('');
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="global-chat-close-btn"
              aria-label="Đóng chat"
              onClick={() => {
                setIsEmojiOpen(false);
                setIsOpen(false);
              }}
            >
              -
            </button>
          </div>

          {activeTab === 'guild' && guildUnavailable ? (
            <p className="global-chat-hint">
              Bạn chưa có bang hội nên chưa thể chat Guild.
            </p>
          ) : null}
          {activeTab === 'guild' && !guildUnavailable && guildName ? (
            <p className="global-chat-hint">Bang hội hiện tại: {guildName}</p>
          ) : null}

          <div className="global-chat-list" ref={listRef}>
            {visibleMessages.map((entry, index) => {
              const prevEntry = index > 0 ? visibleMessages[index - 1] : null;
              const shouldShowDateDivider =
                getDateKey(entry.created_at) &&
                getDateKey(entry.created_at) !== getDateKey(prevEntry?.created_at);

              if (entry.channel === 'system' || entry.isSystem) {
                return (
                  <React.Fragment key={`system-${entry.id}`}>
                    {shouldShowDateDivider ? (
                      <div className="global-chat-date-divider">
                        <span>{formatDateDivider(entry.created_at)}</span>
                      </div>
                    ) : null}
                    <div className="global-chat-item-system-wrap">
                      <div className="global-chat-item system">
                        <p>{entry.message}</p>
                      </div>
                      <span className="global-chat-time">{formatMessageTime(entry.created_at)}</span>
                    </div>
                  </React.Fragment>
                );
              }
              const userName = getDisplayName(entry.user, entry.user?.username || 'Unknown');
              const isOwnMessage = Number(entry.user?.user_id) === Number(user?.userId);
              return (
                <React.Fragment key={`chat-${entry.id}`}>
                  {shouldShowDateDivider ? (
                    <div className="global-chat-date-divider">
                      <span>{formatDateDivider(entry.created_at)}</span>
                    </div>
                  ) : null}
                  <div className={`global-chat-item ${isOwnMessage ? 'own' : ''}`}>
                    <img
                      src={entry.user?.avatar_url || FALLBACK_AVATAR}
                      alt={userName}
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_AVATAR;
                      }}
                    />
                    <div className="global-chat-message-col">
                      <p className="global-chat-user-name">{userName}</p>
                      <div className="global-chat-bubble">
                        <p>{entry.message}</p>
                      </div>
                      <span className="global-chat-time">{formatMessageTime(entry.created_at)}</span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {error ? <p className="global-chat-error">{error}</p> : null}
          {remainingCooldown > 0 ? (
            <p className="global-chat-cooldown">
              Bạn cần chờ {remainingCooldown}s mới gửi tiếp.
            </p>
          ) : null}

          <div className="global-chat-input-wrap">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                activeTab === 'system'
                  ? 'System chỉ hiển thị thông báo...'
                  : activeTab === 'guild'
                  ? 'Nhập tin nhắn bang hội...'
                  : 'Nhập tin nhắn thế giới...'
              }
              maxLength={messageMaxLength}
              disabled={activeTab === 'system' || (activeTab === 'guild' && guildUnavailable)}
            />
            <button
              type="button"
              className="global-chat-emoji-btn"
              onClick={() => setIsEmojiOpen((prev) => !prev)}
              disabled={activeTab === 'system' || (activeTab === 'guild' && guildUnavailable)}
              aria-label="Mở emoji"
            >
              😊
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={
                remainingCooldown > 0 ||
                activeTab === 'system' ||
                (activeTab === 'guild' && guildUnavailable)
              }
            >
              Gửi
            </button>
          </div>
          {isEmojiOpen ? (
            <div className="global-chat-emoji-panel">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handlePickEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default GlobalChatBox;
