import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TemplatePage from './template/TemplatePage';
import { useUser } from '../UserContext';
import { getDisplayName } from '../utils/userDisplay';
import GameDialogModal from './ui/GameDialogModal';
import { initializeRealtimeSocket } from '../realtime/socketClient';
import './BuddiesPage.css';

const FALLBACK_AVATAR = '/images/character/knight_warrior.jpg';

function BuddiesPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const navigate = useNavigate();
  const { user, isLoading } = useUser();

  const [searchKeyword, setSearchKeyword] = useState('');
  const [overview, setOverview] = useState({
    friends: [],
    receivedRequests: [],
    sentRequests: [],
    recommended: [],
    counts: { friends: 0, receivedRequests: 0, sentRequests: 0 },
  });
  const [searchResults, setSearchResults] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const [activeTab, setActiveTab] = useState('friends');
  const [pendingRemoveFriend, setPendingRemoveFriend] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user?.token}`,
    }),
    [user?.token]
  );

  const fetchOverview = useCallback(async () => {
    if (!user?.token) return;
    setLoadingOverview(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/buddies`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể tải danh sách bạn bè');
      setOverview({
        friends: Array.isArray(data.friends) ? data.friends : [],
        receivedRequests: Array.isArray(data.receivedRequests) ? data.receivedRequests : [],
        sentRequests: Array.isArray(data.sentRequests) ? data.sentRequests : [],
        recommended: Array.isArray(data.recommended) ? data.recommended : [],
        counts: data.counts || { friends: 0, receivedRequests: 0, sentRequests: 0 },
      });
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu bạn bè');
    } finally {
      setLoadingOverview(false);
    }
  }, [API_BASE_URL, user?.token]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    fetchOverview();
  }, [isLoading, user, navigate, fetchOverview]);

  useEffect(() => {
    if (!user?.token) return undefined;
    const socket = initializeRealtimeSocket(API_BASE_URL, user.token);
    if (!socket) return undefined;

    const applyPresenceUpdate = (list, payload) =>
      list.map((entry) =>
        Number(entry.user_id) === Number(payload.userId)
          ? {
              ...entry,
              status: payload.status || entry.status,
              online_status: payload.status === 'online' ? 1 : 0,
              last_seen_at: payload.last_seen_at || entry.last_seen_at,
              last_seen_text: payload.last_seen_text || entry.last_seen_text,
            }
          : entry
      );

    const onPresenceUpdate = (payload = {}) => {
      if (!payload?.userId) return;
      setOverview((prev) => ({
        ...prev,
        friends: applyPresenceUpdate(prev.friends, payload),
        recommended: applyPresenceUpdate(prev.recommended, payload),
      }));
      setSearchResults((prev) => applyPresenceUpdate(prev, payload));
    };

    socket.on('presence:update', onPresenceUpdate);
    return () => {
      socket.off('presence:update', onPresenceUpdate);
    };
  }, [API_BASE_URL, user?.token]);

  const handleSearch = async () => {
    if (!user?.token) return;
    const keyword = String(searchKeyword || '').trim();
    if (!keyword) {
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/buddies/search?q=${encodeURIComponent(keyword)}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể tìm kiếm người chơi');
      setSearchResults(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setError(err.message || 'Không thể tìm kiếm người chơi');
    } finally {
      setLoadingSearch(false);
    }
  };

  const doAction = async (key, fn, successMessage) => {
    setActionLoadingKey(key);
    setError('');
    setSuccess('');
    try {
      await fn();
      setSuccess(successMessage);
      await fetchOverview();
      if (String(searchKeyword || '').trim()) {
        await handleSearch();
      }
    } catch (err) {
      setError(err.message || 'Không thể thực hiện thao tác');
    } finally {
      setActionLoadingKey('');
    }
  };

  const sendRequest = async (receiverId) => {
    const response = await fetch(`${API_BASE_URL}/api/buddies/requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ receiverId }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Không thể gửi lời mời');
  };

  const acceptRequest = async (requestId) => {
    const response = await fetch(`${API_BASE_URL}/api/buddies/requests/${requestId}/accept`, {
      method: 'POST',
      headers,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Không thể chấp nhận lời mời');
  };

  const rejectRequest = async (requestId) => {
    const response = await fetch(`${API_BASE_URL}/api/buddies/requests/${requestId}/reject`, {
      method: 'POST',
      headers,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Không thể từ chối lời mời');
  };

  const cancelRequest = async (requestId) => {
    const response = await fetch(`${API_BASE_URL}/api/buddies/requests/${requestId}/cancel`, {
      method: 'POST',
      headers,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Không thể hủy lời mời');
  };

  const removeFriend = async (friendId) => {
    const response = await fetch(`${API_BASE_URL}/api/buddies/${friendId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user?.token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Không thể xóa bạn bè');
  };

  const formatStatusText = (row) => {
    if (row.status === 'online') return 'Online';
    if (row.status === 'away') return 'Away';
    return row.last_seen_text ? `Offline (${row.last_seen_text})` : 'Offline';
  };

  const searchOrRecommend = String(searchKeyword || '').trim() ? searchResults : overview.recommended;

  const renderUserRow = (row, options = {}) => {
    const {
      showStatus = false,
      actionButtons = [],
      keyPrefix = 'user',
    } = options;
    const name = getDisplayName(row, row.username || `UID ${row.user_id}`);
    const guildText = row.guild || '';
    const dotClass =
      row.status === 'online' ? 'online' : row.status === 'away' ? 'away' : 'offline';

    return (
      <div className="buddies-user-row" key={`${keyPrefix}-${row.request_id || row.user_id}`}>
        <button
          type="button"
          className="buddies-avatar-btn"
          onClick={() => navigate(`/profile/${row.user_id}`)}
          title="Xem hồ sơ"
        >
          <img
            src={row.avatar_url || FALLBACK_AVATAR}
            alt={name}
            className="buddies-avatar"
            onError={(event) => {
              event.currentTarget.src = FALLBACK_AVATAR;
            }}
          />
        </button>
        <div className="buddies-user-meta">
          {guildText ? <p className="buddies-user-guild">{guildText}</p> : null}
          <p className="buddies-user-name">{name}</p>
        </div>
        <div className="buddies-user-status-col">
          {showStatus ? (
            <p className="buddies-user-status">
              <span className={`buddies-status-dot ${dotClass}`} />
              {formatStatusText(row)}
            </p>
          ) : null}
        </div>
        <div className="buddies-user-actions">
          {actionButtons.map((button) => (
            <button
              key={button.id}
              type="button"
              className={`buddies-circle-btn ${button.variant || ''}`}
              onClick={button.onClick}
              title={button.title}
              disabled={Boolean(button.disabled)}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const getSearchActionButtons = (row) => {
    if (row.is_friend) {
      return [
        {
          id: 'friend',
          label: '✓',
          title: 'Đã là bạn bè',
          disabled: true,
        },
      ];
    }
    if (row.has_outgoing_request) {
      return [
        {
          id: 'pending-out',
          label: '…',
          title: 'Đã gửi lời mời',
          disabled: true,
        },
      ];
    }
    if (row.has_incoming_request) {
      return [
        {
          id: 'pending-in',
          label: '!',
          title: 'Bạn này đã gửi lời mời cho bạn',
          disabled: true,
        },
      ];
    }

    const actionKey = `send-${row.user_id}`;
    return [
      {
        id: 'add',
        label: actionLoadingKey === actionKey ? '…' : '+',
        title: 'Gửi lời mời kết bạn',
        disabled: actionLoadingKey === actionKey,
        onClick: () =>
          doAction(
            actionKey,
            () => sendRequest(row.user_id),
            'Đã gửi lời mời kết bạn'
          ),
      },
    ];
  };

  if (isLoading || loadingOverview) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="buddies-page">
          <div className="loading">Đang tải danh sách bạn bè...</div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="buddies-page">
        {(error || success) && (
          <div className="buddies-feedback-wrap">
            {error ? <p className="buddies-feedback error">{error}</p> : null}
            {success ? <p className="buddies-feedback success">{success}</p> : null}
          </div>
        )}

        <section className="buddies-card">
          <div className="buddies-tabs">
            <button
              type="button"
              className={`buddies-tab ${activeTab === 'friends' ? 'active' : ''}`}
              onClick={() => setActiveTab('friends')}
            >
              Danh sách bạn bè ({overview.counts.friends || 0})
            </button>
            <button
              type="button"
              className={`buddies-tab ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              Tìm bạn
            </button>
            <button
              type="button"
              className={`buddies-tab ${activeTab === 'received' ? 'active' : ''}`}
              onClick={() => setActiveTab('received')}
            >
              Lời mời đến ({overview.counts.receivedRequests || 0})
            </button>
            <button
              type="button"
              className={`buddies-tab ${activeTab === 'sent' ? 'active' : ''}`}
              onClick={() => setActiveTab('sent')}
            >
              Lời mời đã gởi ({overview.counts.sentRequests || 0})
            </button>
          </div>

          {activeTab === 'search' && (
            <>
              <div className="buddies-search-row">
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="Tìm theo username, UID hoặc display name..."
                />
                <button type="button" onClick={handleSearch} disabled={loadingSearch}>
                  {loadingSearch ? 'Đang tìm...' : 'Tìm'}
                </button>
              </div>
              <div className="buddies-list buddies-list--search">
                {searchOrRecommend.length === 0 ? (
                  <p className="buddies-empty">Không có người chơi phù hợp.</p>
                ) : (
                  searchOrRecommend.map((row) =>
                    renderUserRow(row, {
                      showStatus: true,
                      keyPrefix: 'search',
                      actionButtons: getSearchActionButtons(row),
                    })
                  )
                )}
              </div>
            </>
          )}

          {activeTab === 'friends' && (
            <div className="buddies-list buddies-list--friends">
              {overview.friends.length === 0 ? (
                <p className="buddies-empty">Bạn chưa có bạn bè.</p>
              ) : (
                overview.friends.map((row) => {
                  const actionKey = `remove-${row.user_id}`;
                  return renderUserRow(row, {
                    showStatus: true,
                    keyPrefix: 'friend',
                    actionButtons: [
                      {
                        id: 'remove',
                        label: actionLoadingKey === actionKey ? '…' : '×',
                        title: 'Xóa bạn bè',
                        variant: 'danger',
                        disabled: actionLoadingKey === actionKey,
                        onClick: () => setPendingRemoveFriend(row),
                      },
                    ],
                  });
                })
              )}
            </div>
          )}

          {activeTab === 'received' && (
            <div className="buddies-list buddies-list--request">
              {overview.receivedRequests.length === 0 ? (
                <p className="buddies-empty">Không có lời mời nào.</p>
              ) : (
                overview.receivedRequests.map((row) => {
                  const acceptKey = `accept-${row.request_id}`;
                  const rejectKey = `reject-${row.request_id}`;
                  return renderUserRow(row, {
                    keyPrefix: 'received',
                    actionButtons: [
                      {
                        id: 'accept',
                        label: actionLoadingKey === acceptKey ? '…' : '✓',
                        title: 'Chấp nhận',
                        variant: 'ok',
                        disabled: actionLoadingKey === acceptKey || actionLoadingKey === rejectKey,
                        onClick: () =>
                          doAction(
                            acceptKey,
                            () => acceptRequest(row.request_id),
                            'Đã chấp nhận lời mời'
                          ),
                      },
                      {
                        id: 'reject',
                        label: actionLoadingKey === rejectKey ? '…' : '×',
                        title: 'Hủy bỏ',
                        variant: 'danger',
                        disabled: actionLoadingKey === acceptKey || actionLoadingKey === rejectKey,
                        onClick: () =>
                          doAction(
                            rejectKey,
                            () => rejectRequest(row.request_id),
                            'Đã từ chối lời mời'
                          ),
                      },
                    ],
                  });
                })
              )}
            </div>
          )}

          {activeTab === 'sent' && (
            <div className="buddies-list buddies-list--request">
              {overview.sentRequests.length === 0 ? (
                <p className="buddies-empty">Bạn chưa gửi lời mời nào.</p>
              ) : (
                overview.sentRequests.map((row) => {
                  const cancelKey = `cancel-${row.request_id}`;
                  return renderUserRow(row, {
                    keyPrefix: 'sent',
                    actionButtons: [
                      {
                        id: 'cancel',
                        label: actionLoadingKey === cancelKey ? '…' : '×',
                        title: 'Hủy lời mời',
                        variant: 'danger',
                        disabled: actionLoadingKey === cancelKey,
                        onClick: () =>
                          doAction(
                            cancelKey,
                            () => cancelRequest(row.request_id),
                            'Đã hủy lời mời'
                          ),
                      },
                    ],
                  });
                })
              )}
            </div>
          )}
        </section>

        <GameDialogModal
          isOpen={Boolean(pendingRemoveFriend)}
          title="Xác nhận xóa bạn"
          tone="warning"
          cancelLabel="Hủy"
          confirmLabel="Xóa bạn"
          onClose={() => setPendingRemoveFriend(null)}
          onCancel={() => setPendingRemoveFriend(null)}
          onConfirm={async () => {
            if (!pendingRemoveFriend) return;
            const actionKey = `remove-${pendingRemoveFriend.user_id}`;
            await doAction(
              actionKey,
              () => removeFriend(pendingRemoveFriend.user_id),
              'Đã xóa bạn bè'
            );
            setPendingRemoveFriend(null);
          }}
          confirmDisabled={Boolean(
            pendingRemoveFriend &&
              actionLoadingKey === `remove-${pendingRemoveFriend.user_id}`
          )}
        >
          <p>
            Bạn có chắc muốn xóa{' '}
            <strong>
              {pendingRemoveFriend
                ? getDisplayName(
                    pendingRemoveFriend,
                    pendingRemoveFriend.username || `UID ${pendingRemoveFriend.user_id}`
                  )
                : ''}
            </strong>{' '}
            khỏi danh sách bạn bè?
          </p>
        </GameDialogModal>
      </div>
    </TemplatePage>
  );
}

export default BuddiesPage;
