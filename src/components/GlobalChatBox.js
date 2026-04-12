import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../UserContext';
import { getDisplayName } from '../utils/userDisplay';
import { initializeRealtimeSocket } from '../realtime/socketClient';
import './GlobalChatBox.css';

const FALLBACK_AVATAR = '/images/character/knight_warrior.jpg';

function GlobalChatBox() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const { user, isAuthenticated } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [chatCooldownSeconds, setChatCooldownSeconds] = useState(30);
  const [remainingCooldown, setRemainingCooldown] = useState(0);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.token) return;
    let active = true;

    const loadHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/global?limit=50`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await response.json();
        if (!response.ok || !active) return;
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setChatCooldownSeconds(Number(data.cooldownSeconds || 30));
      } catch (_) {
        // ignore history failure for now
      }
    };

    loadHistory();
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
    };

    const onChatMessage = (payload) => {
      if (!payload) return;
      setMessages((prev) => [...prev.slice(-149), payload]);
    };

    const onChatError = (payload = {}) => {
      if (payload.code === 'CHAT_COOLDOWN') {
        setRemainingCooldown(Number(payload.retryAfterSeconds || 0));
      } else if (payload.message) {
        setError(String(payload.message));
      }
    };

    const onLegendCaught = (payload = {}) => {
      const actorName = getDisplayName(payload.user, payload.user?.username || 'Người chơi');
      const legendMessage = {
        id: `legend-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        created_at: payload.created_at || new Date().toISOString(),
        message: `${actorName} vừa bắt được ${payload.petName || 'Legend Pet'} (${payload.rarity || 'Legend'})!`,
        isSystem: true,
      };
      setMessages((prev) => [...prev.slice(-149), legendMessage]);
    };

    socket.on('chat:config', onChatConfig);
    socket.on('chat:message', onChatMessage);
    socket.on('chat:error', onChatError);
    socket.on('legend:caught', onLegendCaught);

    return () => {
      socket.off('chat:config', onChatConfig);
      socket.off('chat:message', onChatMessage);
      socket.off('chat:error', onChatError);
      socket.off('legend:caught', onLegendCaught);
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
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!user?.token) return;
    const socket = initializeRealtimeSocket(API_BASE_URL, user.token);
    if (!socket) return;
    if (remainingCooldown > 0) return;
    const value = String(text || '').trim();
    if (!value) return;
    socket.emit('chat:send', { message: value });
    setText('');
    setError('');
    setRemainingCooldown(chatCooldownSeconds);
  };

  if (!isAuthenticated || !user?.token) return null;

  return (
    <div className={`global-chat-box ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="global-chat-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? 'Đóng Chat' : 'Mở Chat'}
      </button>

      {isOpen && (
        <div className="global-chat-panel">
          <div className="global-chat-header">
            <h4>Global Chat</h4>
            <span>Cooldown: {chatCooldownSeconds}s</span>
          </div>

          <div className="global-chat-list" ref={listRef}>
            {messages.map((entry) => {
              if (entry.isSystem) {
                return (
                  <div key={entry.id} className="global-chat-item system">
                    {entry.message}
                  </div>
                );
              }
              const userName = getDisplayName(entry.user, entry.user?.username || 'Unknown');
              return (
                <div key={entry.id} className="global-chat-item">
                  <img
                    src={entry.user?.avatar_url || FALLBACK_AVATAR}
                    alt={userName}
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_AVATAR;
                    }}
                  />
                  <div className="global-chat-bubble">
                    <p className="meta">{userName}</p>
                    <p>{entry.message}</p>
                  </div>
                </div>
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
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Nhập tin nhắn..."
              maxLength={500}
            />
            <button type="button" onClick={handleSend} disabled={remainingCooldown > 0}>
              Gửi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GlobalChatBox;
