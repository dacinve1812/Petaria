import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../UserContext';
import TemplatePage from './template/TemplatePage';
import { getDisplayName } from '../utils/userDisplay';
import './ExhibitionRoom.css';

function ExhibitionRoom() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const { user, isLoading } = useUser();
  const { userId: urlUserId } = useParams();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [maxItems, setMaxItems] = useState(10);
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState('');
  const [copyingLink, setCopyingLink] = useState(false);
  const [reorderingId, setReorderingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);

  const targetUserId = useMemo(
    () => String(urlUserId || user?.userId || ''),
    [urlUserId, user?.userId]
  );
  const isOwner = String(user?.userId || '') === targetUserId;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (!targetUserId) return;

    const fetchExhibition = async () => {
      setLoadingPage(true);
      setError('');
      try {
        const headers = { Authorization: `Bearer ${user.token}` };
        const [exhibitionRes, profileRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users/${targetUserId}/exhibition`, { headers }),
          fetch(`${API_BASE_URL}/users/${targetUserId}`, { headers }),
        ]);

        const exhibitionData = await exhibitionRes.json();
        if (!exhibitionRes.ok) {
          throw new Error(exhibitionData?.message || 'Không thể tải phòng triển lãm');
        }
        setItems(Array.isArray(exhibitionData?.items) ? exhibitionData.items : []);
        setMaxItems(Number(exhibitionData?.maxItems || 10));

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setOwnerProfile(profileData || null);
        } else {
          setOwnerProfile(null);
        }
      } catch (err) {
        setError(err.message || 'Không thể tải phòng triển lãm');
      } finally {
        setLoadingPage(false);
      }
    };

    fetchExhibition();
  }, [API_BASE_URL, isLoading, navigate, targetUserId, user]);

  const shareUrl = useMemo(() => {
    if (!targetUserId) return '';
    if (typeof window === 'undefined') return `/exhibition/${targetUserId}`;
    return `${window.location.origin}/exhibition/${targetUserId}`;
  }, [targetUserId]);

  const handleCopyLink = async () => {
    try {
      setCopyingLink(true);
      await navigator.clipboard.writeText(shareUrl);
    } finally {
      window.setTimeout(() => setCopyingLink(false), 900);
    }
  };

  const reorderLocalItems = (exhibitionItemId, direction) => {
    setItems((prev) => {
      const currentIndex = prev.findIndex((item) => Number(item.exhibition_id) === Number(exhibitionItemId));
      if (currentIndex === -1) return prev;
      const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const temp = next[currentIndex];
      next[currentIndex] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleMove = async (exhibitionItemId, direction) => {
    if (!isOwner || !user?.token) return;
    setReorderingId(exhibitionItemId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/exhibition/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          exhibitionItemId,
          direction,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Không thể đổi vị trí vật phẩm');
      }
      reorderLocalItems(exhibitionItemId, direction);
    } catch (err) {
      alert(err.message || 'Không thể đổi vị trí vật phẩm');
    } finally {
      setReorderingId(null);
    }
  };

  const handleRemoveItem = async (exhibitionItemId) => {
    if (!isOwner || !user?.token) return;
    const ok = window.confirm('Gỡ vật phẩm này khỏi phòng triển lãm và trả về kho đồ?');
    if (!ok) return;

    setRemovingId(exhibitionItemId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/exhibition/${exhibitionItemId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Không thể gỡ vật phẩm khỏi triển lãm');
      }
      setItems((prev) => prev.filter((item) => Number(item.exhibition_id) !== Number(exhibitionItemId)));
    } catch (err) {
      alert(err.message || 'Không thể gỡ vật phẩm khỏi triển lãm');
    } finally {
      setRemovingId(null);
    }
  };

  const ownerName = useMemo(() => {
    return getDisplayName(ownerProfile, ownerProfile?.username || `UID ${targetUserId}`);
  }, [ownerProfile, targetUserId]);

  const visibleItems = items.slice(0, maxItems);
  const placeholderCount = visibleItems.length > 0 ? Math.max(0, maxItems - visibleItems.length) : 0;

  if (isLoading || loadingPage) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="exhibition-room-page">
          <div className="exhibition-room-loading">Đang tải phòng triển lãm...</div>
        </div>
      </TemplatePage>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="exhibition-room-page">
        <div className="exhibition-room-header">
          <p>{isOwner ? 'Phòng Triễn Lãm của bạn' : `Phòng Triễn Lãm ${ownerName}`}</p>
        </div>

        {error && <div className="exhibition-room-error">{error}</div>}

        <div className="exhibition-room-meta">
          <span>Đã trưng bày: {items.length}/{maxItems} vật phẩm</span>
          {isOwner ? <span>Bạn có thể dùng mũi tên để đổi vị trí trái/phải.</span> : null}
        </div>

        <div className="exhibition-stage">
          {visibleItems.map((item, index) => (
            <article key={item.exhibition_id} className="exhibition-slot">
              <div className="exhibition-slot-platform">
                <img
                  src={`/images/equipments/${item.image_url}`}
                  alt={item.name || 'exhibition item'}
                  className="exhibition-slot-image"
                />
              </div>
              <div className="exhibition-slot-name">{item.name || 'Vật phẩm'}</div>
              {isOwner ? (
                <div className="exhibition-slot-actions">
                  <button
                    type="button"
                    onClick={() => handleMove(item.exhibition_id, 'left')}
                    disabled={index === 0 || reorderingId === item.exhibition_id || removingId === item.exhibition_id}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(item.exhibition_id, 'right')}
                    disabled={index === visibleItems.length - 1 || reorderingId === item.exhibition_id || removingId === item.exhibition_id}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.exhibition_id)}
                    disabled={removingId === item.exhibition_id || reorderingId === item.exhibition_id}
                  >
                    {removingId === item.exhibition_id ? '…' : 'Gỡ'}
                  </button>
                </div>
              ) : null}
            </article>
          ))}

          {Array.from({ length: placeholderCount }, (_, index) => (
            <article key={`placeholder-${index}`} className="exhibition-slot exhibition-slot--placeholder">
              <div className="exhibition-slot-platform">
                <span className="exhibition-slot-placeholder-mark">Trống</span>
              </div>
              <div className="exhibition-slot-name">Ô trưng bày</div>
            </article>
          ))}
          {visibleItems.length === 0 ? (
            <div className="exhibition-room-empty">
              Chưa có vật phẩm nào trong phòng triễn lãm.
            </div>
          ) : null}
        </div>

        {isOwner ? (
          <div className="exhibition-share-card">
            <h3>Link chia sẻ phòng triển lãm</h3>
            <div className="exhibition-share-row">
              <input type="text" readOnly value={shareUrl} />
              <button type="button" onClick={handleCopyLink}>
                {copyingLink ? 'Đã copy' : 'Copy'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </TemplatePage>
  );
}

export default ExhibitionRoom;
