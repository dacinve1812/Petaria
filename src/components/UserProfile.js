import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';
import TemplatePage from './template/TemplatePage';
import { getDisplayName } from '../utils/userDisplay';
import './UserProfile.css';

function UserProfile() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { userId: urlUserId } = useParams();
  const { user: currentUser, isLoading } = React.useContext(UserContext);
  const [profileUser, setProfileUser] = useState(null);
  const [pets, setPets] = useState([]);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [isCopyingId, setIsCopyingId] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const idToFetch = urlUserId ? urlUserId : currentUser.userId;

    const headers = { Authorization: `Bearer ${currentUser.token}` };
    Promise.all([
      fetch(`${API_BASE_URL}/users/${idToFetch}`, { headers }).then((response) => response.json()),
      fetch(`${API_BASE_URL}/users/${idToFetch}/pets`, { headers })
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []),
    ])
      .then(([profileData, petData]) => {
        setProfileUser(profileData);
        setPets(Array.isArray(petData) ? petData : []);
      })
      .catch((error) => console.error('Error fetching user profile:', error));
  }, [urlUserId, currentUser, isLoading, navigate, API_BASE_URL]);

  const profileId = String(profileUser?.id ?? profileUser?.userId ?? urlUserId ?? currentUser?.userId ?? '');
  const isOwner = String(currentUser?.userId ?? '') === profileId;
  const effectiveName = getDisplayName(profileUser, 'Unknown');
  const avatarUrl = profileUser?.avatar_url || '/images/character/knight_warrior.jpg';
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/profile/${profileId}`;
    return `${window.location.origin}/profile/${profileId}`;
  }, [profileId]);

  const topPets = useMemo(
    () =>
      [...pets]
        .sort((a, b) => (Number(b.level) || 0) - (Number(a.level) || 0))
        .slice(0, 6),
    [pets]
  );

  const copyText = async (text, type) => {
    try {
      if (type === 'link') setIsCopyingLink(true);
      if (type === 'id') setIsCopyingId(true);
      await navigator.clipboard.writeText(String(text || ''));
    } finally {
      window.setTimeout(() => {
        if (type === 'link') setIsCopyingLink(false);
        if (type === 'id') setIsCopyingId(false);
      }, 900);
    }
  };

  if (isLoading) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="profile-page-container">
          <div className="loading">Đang tải...</div>
        </div>
      </TemplatePage>
    );
  }

  if (!currentUser) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="profile-page-container">
          <div className="error">Vui lòng đăng nhập</div>
        </div>
      </TemplatePage>
    );
  }

  if (!profileUser) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="profile-page-container">
          <div className="loading">Đang tải thông tin...</div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="profile-page-container">
        <div className="header-free">
          <p>Hồ sơ người chơi</p>
        </div>

        <div className="user-profile">
          <div className="profile-header">
            <img
              src={avatarUrl}
              alt="Profile"
              className="profile-picture"
              onError={(event) => {
                event.currentTarget.src = '/images/character/knight_warrior.jpg';
              }}
            />
            <h2>{effectiveName}</h2>
            <span
              className={`profile-status-badge ${profileUser.online_status ? 'online' : 'offline'}`}
            >
              {profileUser.online_status ? 'Đang Online' : 'Offline'}
            </span>
          </div>

          <div className="profile-details">
            <p><strong>Tài khoản:</strong> {profileUser.username || 'Chưa cập nhật'}</p>
            <p><strong>Tên hiển thị:</strong> {profileUser.display_name || 'Chưa cập nhật'}</p>
            <p><strong>Tên thật:</strong> {profileUser.real_name || 'Chưa cập nhật'}</p>
            <p><strong>Giới tính:</strong> {profileUser.gender || 'Chưa cập nhật'}</p>
            <p><strong>Bang hội:</strong> {profileUser.guild || 'Chưa có'}</p>
            <p><strong>Danh hiệu:</strong> {profileUser.title || 'Chưa có'}</p>
            <p><strong>Hạng:</strong> {profileUser.ranking || 'Chưa có'}</p>
            <p><strong>Peta:</strong> {Number(profileUser.peta ?? profileUser.gold ?? 0).toLocaleString()}</p>
            <p><strong>PetaGold:</strong> {Number(profileUser.petagold ?? 0).toLocaleString()}</p>
            <p><strong>Ngày sinh:</strong> {profileUser.birthday || 'Chưa cập nhật'}</p>
            {isOwner && (
              <button
                type="button"
                className="profile-edit-btn"
                onClick={() => navigate('/profile/edit')}
              >
                Cập nhật hồ sơ
              </button>
            )}
          </div>
        </div>

        <div className="profile-pets-card">
          <h3>Top 6 thú cưng đẳng cấp cao nhất</h3>
          <table className="profile-pets-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Loài</th>
                <th>Đẳng cấp</th>
              </tr>
            </thead>
            <tbody>
              {topPets.length === 0 ? (
                <tr>
                  <td colSpan={3} className="profile-pets-empty">Chưa có thú cưng.</td>
                </tr>
              ) : (
                topPets.map((pet) => (
                  <tr key={pet.uuid || `${pet.name}-${pet.level}`}>
                    <td>
                      {pet.uuid ? (
                        <Link to={`/pet/${pet.uuid}`} className="profile-pet-link">
                          {pet.name || 'Không tên'}
                        </Link>
                      ) : (
                        <span>{pet.name || 'Không tên'}</span>
                      )}
                    </td>
                    <td>{pet.species_name || pet.pet_types_name || '-'}</td>
                    <td>{Number(pet.level || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="profile-share-card">
          <h3>Link chia sẻ</h3>
          <div className="profile-share-row">
            <input type="text" readOnly value={shareUrl} />
            <button type="button" onClick={() => copyText(shareUrl, 'link')}>
              {isCopyingLink ? 'Đã copy' : 'Copy'}
            </button>
          </div>
          <div className="profile-share-meta">
            <span>Public ID: {profileId}</span>
            <button type="button" onClick={() => copyText(profileId, 'id')}>
              {isCopyingId ? 'Đã copy' : 'Copy ID'}
            </button>
          </div>
        </div>
      </div>
    </TemplatePage>
  );
}

export default UserProfile;