import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../UserContext';
import { getDisplayName } from '../utils/userDisplay';
import { getBannerPresentation } from '../utils/guildBanners';
import './GuildDetailPage.css';

function GuildDetailPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const { name } = useParams();
  const navigate = useNavigate();
  const { user, isLoading } = useUser();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState(null);

  const fetchDetail = useCallback(async () => {
    if (!user?.token || !name) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/guilds/${encodeURIComponent(name)}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể tải thông tin bang hội');
      setDetail(data);
    } catch (err) {
      setError(err.message || 'Không thể tải thông tin bang hội');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, name, user?.token]);

  useEffect(() => {
    if (isLoading) return;
    if (!user?.token) {
      navigate('/login');
      return;
    }
    fetchDetail();
  }, [fetchDetail, isLoading, navigate, user?.token]);

  const handleApply = async () => {
    if (!user?.token || !name) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/guilds/${encodeURIComponent(name)}/apply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể xin gia nhập bang hội');
      setSuccess(data?.message || 'Đã gửi yêu cầu');
      if (data?.joined) {
        navigate('/guild');
        return;
      }
      await fetchDetail();
    } catch (err) {
      setError(err.message || 'Không thể xin gia nhập bang hội');
    } finally {
      setSubmitting(false);
    }
  };

  const guild = detail?.guild;
  const leaderName = getDisplayName(
    { display_name: guild?.owner_display_name, username: guild?.owner_username },
    guild?.owner_username || 'Guild Leader'
  );
  const admissionText = guild?.admission_type === 'approval' ? 'Needs Approval' : 'Free to Join';
  const showApplyAction = Boolean(guild) && !detail?.myGuildName;
  const applyDisabled = !detail?.canApply || detail?.hasPendingRequest || submitting || !guild;

  return (
    <section className="guild-detail-page">
      <button type="button" className="guild-detail-back" onClick={() => navigate('/guild')}>
        ← Quay lại danh sách guild
      </button>

      {error ? <p className="guild-detail-feedback guild-detail-feedback--error">{error}</p> : null}
      {success ? <p className="guild-detail-feedback guild-detail-feedback--success">{success}</p> : null}
      {loading ? <p className="guild-detail-feedback">Đang tải thông tin guild...</p> : null}

      {guild ? (
        <div className="guild-detail-card">
          <div className="guild-detail-main">
            <aside className="guild-detail-left">
              <div className="guild-detail-level">Lv.{guild.level}</div>
              <div className="guild-detail-name">{guild.name}</div>
              <div
                className="guild-detail-banner"
                style={getBannerPresentation(guild.banner_url).style}
              />
              <div className="guild-detail-leader">
                <img
                  src={guild.owner_avatar_url || '/images/character/knight_warrior.jpg'}
                  alt={leaderName}
                  onError={(event) => {
                    event.currentTarget.src = '/images/character/knight_warrior.jpg';
                  }}
                />
                <div>
                  <p className="guild-detail-leader-role">Leader</p>
                  <p className="guild-detail-leader-name">{leaderName}</p>
                </div>
              </div>
            </aside>

            <section className="guild-detail-right">
              <h3>Guild Notice</h3>
              <p className="guild-detail-description">
                {guild.description || 'Guild chưa có mô tả.'}
              </p>

              <div className="guild-detail-stats">
                <div className="guild-detail-stat-row">
                  <span>Tag</span>
                  <strong>#{String(guild.name || '').replace(/\s+/g, '')}</strong>
                </div>
                <div className="guild-detail-stat-row">
                  <span>Members</span>
                  <strong>
                    {guild.member_count}/{guild.member_limit}
                  </strong>
                </div>
                <div className="guild-detail-stat-row">
                  <span>Admission Type</span>
                  <strong>{admissionText}</strong>
                </div>
                <div className="guild-detail-stat-row">
                  <span>Guild Language</span>
                  <strong>All Languages</strong>
                </div>
                <div className="guild-detail-stat-row">
                  <span>Arena Rank</span>
                  <strong>No Rank Restriction</strong>
                </div>
              </div>

            </section>
          </div>

          {showApplyAction ? (
            <div className="guild-detail-actions">
              <button type="button" onClick={handleApply} disabled={applyDisabled}>
                {detail?.hasPendingRequest
                  ? 'Đã gửi yêu cầu'
                  : submitting
                  ? 'Đang xử lý...'
                  : 'Apply (Xin gia nhập)'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default GuildDetailPage;

