import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import { getDisplayName } from '../utils/userDisplay';
import { getBannerPresentation } from '../utils/guildBanners';
import GameDialogModal from './ui/GameDialogModal';
import './GuildPage.css';

function GuildPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const navigate = useNavigate();
  const { user, isLoading } = useUser();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guilds, setGuilds] = useState([]);
  const [myGuild, setMyGuild] = useState(null);
  const [canCreateGuild, setCanCreateGuild] = useState(true);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [guildSearchKeyword, setGuildSearchKeyword] = useState('');
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [guildMembers, setGuildMembers] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [canApproveMembers, setCanApproveMembers] = useState(false);
  const [requesterGuildRole, setRequesterGuildRole] = useState('member');
  const [isAppliedListModalOpen, setIsAppliedListModalOpen] = useState(false);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [applicationsError, setApplicationsError] = useState('');
  const [appliedGuilds, setAppliedGuilds] = useState([]);
  const [cancelRequestLoadingId, setCancelRequestLoadingId] = useState(0);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [loadingApproveList, setLoadingApproveList] = useState(false);
  const [approveListError, setApproveListError] = useState('');
  const [pendingJoinRequests, setPendingJoinRequests] = useState([]);
  const [approvingRequestId, setApprovingRequestId] = useState(0);
  const [roleDraftByUserId, setRoleDraftByUserId] = useState({});
  const [roleSavingUserId, setRoleSavingUserId] = useState(0);
  const [pendingKickMember, setPendingKickMember] = useState(null);
  const [kickingMemberId, setKickingMemberId] = useState(0);
  const [isDisbandModalOpen, setIsDisbandModalOpen] = useState(false);
  const [disbandConfirmText, setDisbandConfirmText] = useState('');
  const [disbandSubmitting, setDisbandSubmitting] = useState(false);
  const [disbandError, setDisbandError] = useState('');

  const fetchGuilds = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/guilds`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể tải danh sách bang hội');
      setGuilds(Array.isArray(data.guilds) ? data.guilds : []);
      setMyGuild(data.myGuild || null);
      setCanCreateGuild(Boolean(data.canCreateGuild));
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách bang hội');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, user?.token]);

  useEffect(() => {
    if (isLoading) return;
    if (!user?.token) {
      navigate('/login');
      return;
    }
    fetchGuilds();
  }, [fetchGuilds, isLoading, navigate, user?.token]);

  const isGuildOwner = Number(myGuild?.owner_user_id) === Number(user?.userId);

  const formatAdmission = (value) =>
    value === 'approval' ? 'Needs Approval' : 'Free to Join';

  const formatGuildDate = (rawDate) => {
    if (!rawDate) return '--/--/----';
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return '--/--/----';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const filteredGuilds = useMemo(() => {
    const keyword = String(guildSearchKeyword || '').trim().toLowerCase();
    if (!keyword) return guilds;
    return guilds.filter((guild) => {
      const name = String(guild.name || '').toLowerCase();
      const tag = `#${String(guild.name || '').replace(/\s+/g, '').toLowerCase()}`;
      const admission = String(guild.admission_type || '').toLowerCase();
      return name.includes(keyword) || tag.includes(keyword) || admission.includes(keyword);
    });
  }, [guildSearchKeyword, guilds]);

  const fetchGuildMembers = useCallback(async () => {
    if (!user?.token || !myGuild) return;
    setLoadingMembers(true);
    setMembersError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/guilds/my/members`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể tải danh sách thành viên');
      setGuildMembers(Array.isArray(data.members) ? data.members : []);
      setPendingCount(Number(data.pendingCount) || 0);
      setCanApproveMembers(Boolean(data.canApprove));
      setRequesterGuildRole(String(data.requesterRole || 'member'));
    } catch (err) {
      setMembersError(err.message || 'Không thể tải danh sách thành viên');
    } finally {
      setLoadingMembers(false);
    }
  }, [API_BASE_URL, myGuild, user?.token]);

  const fetchMyApplications = useCallback(async () => {
    if (!user?.token || myGuild) return;
    setLoadingApplications(true);
    setApplicationsError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/guilds/my/applications`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể tải danh sách đơn đã nộp');
      setAppliedGuilds(Array.isArray(data.applications) ? data.applications : []);
    } catch (err) {
      setApplicationsError(err.message || 'Không thể tải danh sách đơn đã nộp');
    } finally {
      setLoadingApplications(false);
    }
  }, [API_BASE_URL, myGuild, user?.token]);

  const cancelMyApplication = async (requestId) => {
    if (!user?.token) return;
    setCancelRequestLoadingId(requestId);
    setApplicationsError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/guilds/my/applications/${requestId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể hủy đơn');
      await fetchMyApplications();
    } catch (err) {
      setApplicationsError(err.message || 'Không thể hủy đơn');
    } finally {
      setCancelRequestLoadingId(0);
    }
  };

  const fetchPendingJoinRequests = useCallback(async () => {
    if (!user?.token || !myGuild) return;
    setLoadingApproveList(true);
    setApproveListError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/guilds/my/join-requests`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể tải danh sách đơn');
      setPendingJoinRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (err) {
      setApproveListError(err.message || 'Không thể tải danh sách đơn');
    } finally {
      setLoadingApproveList(false);
    }
  }, [API_BASE_URL, myGuild, user?.token]);

  const resolveJoinRequest = async (requestId, action) => {
    if (!user?.token) return;
    const endpoint =
      action === 'approve'
        ? `${API_BASE_URL}/api/guilds/my/join-requests/${requestId}/approve`
        : `${API_BASE_URL}/api/guilds/my/join-requests/${requestId}/reject`;
    setApprovingRequestId(requestId);
    setApproveListError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể xử lý đơn');
      await Promise.all([fetchGuildMembers(), fetchPendingJoinRequests()]);
    } catch (err) {
      setApproveListError(err.message || 'Không thể xử lý đơn');
    } finally {
      setApprovingRequestId(0);
    }
  };

  const roleLabel = (role) => {
    if (role === 'leader') return 'Leader';
    if (role === 'officer') return 'Officer';
    if (role === 'elite') return 'Elite';
    return 'Member';
  };

  const rolePriority = (role) => {
    if (role === 'leader') return 1;
    if (role === 'officer') return 2;
    if (role === 'elite') return 3;
    return 4;
  };

  const memberStatusLabel = (row) => {
    if (row.status === 'online') return 'Online';
    if (row.status === 'away') return 'Away';
    return row.last_seen_text ? `Offline (${row.last_seen_text})` : 'Offline';
  };

  useEffect(() => {
    const nextDraft = {};
    guildMembers.forEach((member) => {
      nextDraft[member.user_id] = member.role || 'member';
    });
    setRoleDraftByUserId(nextDraft);
  }, [guildMembers]);

  const canKickMember = (member) => {
    if (!member) return false;
    if (!['leader', 'officer'].includes(requesterGuildRole)) return false;
    if (Number(member.user_id) === Number(user?.userId)) return false;
    return rolePriority(requesterGuildRole) < rolePriority(member.role);
  };

  const canLeaderChangeRole = (member) => {
    if (!member) return false;
    if (requesterGuildRole !== 'leader') return false;
    if (Number(member.user_id) === Number(user?.userId)) return false;
    return true;
  };

  const canDisbandGuild = Boolean(myGuild) && isGuildOwner && Number(myGuild.member_count) === 1;

  const handleDisbandGuild = async () => {
    if (!user?.token || !myGuild) return;
    setDisbandSubmitting(true);
    setDisbandError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/guilds/my/disband`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ confirmName: disbandConfirmText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể disband guild');
      setIsDisbandModalOpen(false);
      setDisbandConfirmText('');
      await fetchGuilds();
    } catch (err) {
      setDisbandError(err.message || 'Không thể disband guild');
    } finally {
      setDisbandSubmitting(false);
    }
  };

  const kickMember = async () => {
    if (!user?.token || !pendingKickMember) return;
    setKickingMemberId(Number(pendingKickMember.user_id));
    setMembersError('');
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/guilds/my/members/${pendingKickMember.user_id}/kick`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể kick thành viên');
      setPendingKickMember(null);
      await Promise.all([fetchGuildMembers(), fetchPendingJoinRequests()]);
    } catch (err) {
      setMembersError(err.message || 'Không thể kick thành viên');
    } finally {
      setKickingMemberId(0);
    }
  };

  const updateMemberRole = async (member) => {
    if (!user?.token || !member) return;
    const nextRole = String(roleDraftByUserId[member.user_id] || member.role || 'member');
    setRoleSavingUserId(Number(member.user_id));
    setMembersError('');
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/guilds/my/members/${member.user_id}/role`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({ role: nextRole }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể đổi role');
      await Promise.all([fetchGuildMembers(), fetchGuilds()]);
    } catch (err) {
      setMembersError(err.message || 'Không thể đổi role');
    } finally {
      setRoleSavingUserId(0);
    }
  };

  return (
    <section className="page-content">
      {myGuild ? (
        <div className="guild-dashboard">
          <div className="guild-dashboard-main">
            <aside className="guild-dashboard-left">
              <div className="guild-level-chip">Lv.{myGuild.level}</div>
              <div className="guild-name-chip">{myGuild.name}</div>
              <div
                className="guild-dashboard-banner"
                style={getBannerPresentation(myGuild.banner_url).style}
              />
              <div className="guild-dashboard-left-actions">
                <button type="button" onClick={() => setIsSearchModalOpen(true)}>Search</button>
                <button
                  type="button"
                  onClick={() => navigate('/guild/edit')}
                  disabled={!isGuildOwner}
                  title={isGuildOwner ? 'Chỉnh sửa bang hội' : 'Chỉ chủ bang mới có thể chỉnh sửa'}
                >
                  Edit
                </button>
              </div>
            </aside>

            <section className="guild-dashboard-right">
              <div className="guild-intro-card">
                <div className="guild-intro-head">
                  <h3>Guild Introduction</h3>
                  <button type="button">Discord</button>
                </div>
                <p>{myGuild.description || 'Competitive guild - welcome new members.'}</p>
              </div>

              <div className="guild-stat-list">
                <div className="guild-stat-row">
                  <span>Tag</span>
                  <strong>#{myGuild.name.replace(/\s+/g, '')}</strong>
                </div>
                <div className="guild-stat-row">
                  <span>Members</span>
                  <strong>
                    {myGuild.member_count}/{myGuild.member_limit}
                  </strong>
                </div>
                <div className="guild-stat-row">
                  <span>Admission Type</span>
                  <strong>{formatAdmission(myGuild.admission_type)}</strong>
                </div>
                <div className="guild-stat-row">
                  <span>Guild Language</span>
                  <strong>All Languages</strong>
                </div>
                <div className="guild-stat-row">
                  <span>Arena Rank</span>
                  <strong>No Rank Restriction</strong>
                </div>
                <div className="guild-stat-row">
                  <span>Creation Date</span>
                  <strong>{formatGuildDate(myGuild.created_at)}</strong>
                </div>
              </div>

              <div className="guild-dashboard-right-actions">
                <button type="button">Rewards</button>
              </div>
            </section>
          </div>

          <nav className="guild-dashboard-menu">
            <button type="button">Guild Missions</button>
            <button
              type="button"
              className="active"
              onClick={() => {
                setIsMembersModalOpen(true);
                fetchGuildMembers();
              }}
            >
              Members
            </button>
            <button type="button">Guild Shop</button>
            <button type="button">Castle Rush</button>
            <button type="button">Guild War</button>
          </nav>

          <div className="guild-dashboard-bottom-actions">
            <button
              type="button"
              className="guild-disband-btn"
              onClick={() => {
                setDisbandError('');
                setDisbandConfirmText('');
                setIsDisbandModalOpen(true);
              }}
              disabled={!canDisbandGuild}
              title={
                canDisbandGuild
                  ? 'Giải tán bang hội'
                  : 'Chỉ Leader và guild còn 1 thành viên mới có thể disband'
              }
            >
              Disband Guild
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="guild-feedback guild-feedback--error">{error}</p> : null}
      {loading ? <p className="guild-feedback">Đang tải danh sách bang hội...</p> : null}

      {!myGuild ? (
        <>
          <div className="guild-page-top">
            <div>
              <h2>Danh sách bang hội</h2>
              <p>Khởi đầu giới hạn thành viên là 10, tối đa 30 khi bang hội đạt Lv.10.</p>
            </div>
            <button
              type="button"
              className="guild-create-btn"
              onClick={() => navigate('/guild/create')}
              disabled={!canCreateGuild}
            >
              Tạo Bang Hội
            </button>
            <button
              type="button"
              className="guild-create-btn"
              onClick={() => {
                setIsAppliedListModalOpen(true);
                fetchMyApplications();
              }}
            >
              Danh sách đã nộp đơn
            </button>
          </div>

          <div className="guild-search-shell">
            <div className="guild-search-toolbar">
              <input
                type="text"
                value={guildSearchKeyword}
                onChange={(event) => setGuildSearchKeyword(event.target.value)}
                placeholder="Tìm theo tên guild, tag..."
              />
              <button type="button" onClick={fetchGuilds}>Refresh</button>
            </div>

            <div className="guild-search-list">
              {filteredGuilds.map((guild) => (
                <article
                  className="guild-search-row clickable"
                  key={`list-${guild.id}`}
                  onClick={() => navigate(`/guild/${encodeURIComponent(guild.name)}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/guild/${encodeURIComponent(guild.name)}`);
                    }
                  }}
                >
                  <div
                    className="guild-search-banner"
                    style={getBannerPresentation(guild.banner_url).style}
                  />
                  <div className="guild-search-main">
                    <p className="guild-search-name">
                      Lv.{guild.level} {guild.name}
                    </p>
                    <p>
                      {guild.member_count}/{guild.member_limit} #{String(guild.name || '').replace(/\s+/g, '')}
                    </p>
                  </div>
                  <div className="guild-search-side">
                    <p>{formatAdmission(guild.admission_type)}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {isSearchModalOpen ? (
        <div className="guild-modal-backdrop" onClick={() => setIsSearchModalOpen(false)}>
          <div className="guild-modal guild-search-modal" onClick={(event) => event.stopPropagation()}>
            <div className="guild-modal-header">
              <h3>Recommended Guilds</h3>
              <button type="button" onClick={() => setIsSearchModalOpen(false)}>✕</button>
            </div>

            <div className="guild-search-toolbar">
              <input
                type="text"
                value={guildSearchKeyword}
                onChange={(event) => setGuildSearchKeyword(event.target.value)}
                placeholder="Tìm theo tên guild, tag..."
              />
              <button type="button" onClick={fetchGuilds}>Refresh</button>
            </div>

            <div className="guild-search-list">
              {filteredGuilds.map((guild) => (
                <article
                  className="guild-search-row clickable"
                  key={`search-${guild.id}`}
                  onClick={() => navigate(`/guild/${encodeURIComponent(guild.name)}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/guild/${encodeURIComponent(guild.name)}`);
                    }
                  }}
                >
                  <div
                    className="guild-search-banner"
                    style={getBannerPresentation(guild.banner_url).style}
                  />
                  <div className="guild-search-main">
                    <p className="guild-search-name">
                      Lv.{guild.level} {guild.name}
                    </p>
                    <p>
                      {guild.member_count}/{guild.member_limit} #{String(guild.name || '').replace(/\s+/g, '')}
                    </p>
                  </div>
                  <div className="guild-search-side">
                    <p>{formatAdmission(guild.admission_type)}</p>
                    {!myGuild ? (
                      <button type="button" disabled={guild.is_full}>
                        {guild.is_full ? 'Đã đầy' : 'Join'}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {isMembersModalOpen ? (
        <div className="guild-modal-backdrop" onClick={() => setIsMembersModalOpen(false)}>
          <div className="guild-modal guild-members-modal" onClick={(event) => event.stopPropagation()}>
            <div className="guild-modal-header">
              <h3>Members ({guildMembers.length}/{myGuild?.member_limit || 0})</h3>
              <button type="button" onClick={() => setIsMembersModalOpen(false)}>✕</button>
            </div>

            <p className="guild-members-role-note">
              Guild Position: <strong>{roleLabel(requesterGuildRole)}</strong>
            </p>

            {membersError ? <p className="guild-feedback guild-feedback--error">{membersError}</p> : null}
            {loadingMembers ? <p className="guild-feedback">Đang tải danh sách thành viên...</p> : null}

            <div className="guild-members-list">
              {guildMembers.map((member) => (
                <article className="guild-member-row" key={`member-${member.user_id}`}>
                  <img
                    src={member.avatar_url || '/images/character/knight_warrior.jpg'}
                    alt={getDisplayName(member, member.username || `UID ${member.user_id}`)}
                    onError={(event) => {
                      event.currentTarget.src = '/images/character/knight_warrior.jpg';
                    }}
                  />
                  <div className="guild-member-main">
                    {member.role !== 'member' ? (
                      <p className={`guild-member-inline-role role-${member.role}`}>
                        {roleLabel(member.role)}
                      </p>
                    ) : null}
                    <p className="guild-member-name">
                      {getDisplayName(member, member.username || `UID ${member.user_id}`)}
                    </p>
                    <p className="guild-member-status">{memberStatusLabel(member)}</p>
                  </div>
                  <div className="guild-member-actions">
                    {canKickMember(member) ? (
                      <button
                        type="button"
                        className="guild-member-kick-btn"
                        onClick={() => setPendingKickMember(member)}
                        disabled={kickingMemberId === Number(member.user_id)}
                      >
                        Kick
                      </button>
                    ) : null}

                    {canLeaderChangeRole(member) ? (
                      <div className="guild-member-role-editor">
                        <select
                          value={roleDraftByUserId[member.user_id] || member.role || 'member'}
                          onChange={(event) =>
                            setRoleDraftByUserId((prev) => ({
                              ...prev,
                              [member.user_id]: event.target.value,
                            }))
                          }
                        >
                          <option value="member">Member</option>
                          <option value="elite">Elite</option>
                          <option value="officer">Officer</option>
                          <option value="leader">Leader</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => updateMemberRole(member)}
                          disabled={
                            roleSavingUserId === Number(member.user_id) ||
                            (roleDraftByUserId[member.user_id] || member.role) === member.role
                          }
                        >
                          Role
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {canApproveMembers ? (
              <div className="guild-members-footer">
                <button
                  type="button"
                  onClick={() => {
                    setIsApproveModalOpen(true);
                    fetchPendingJoinRequests();
                  }}
                >
                  Approve {pendingCount > 0 ? `(${pendingCount})` : ''}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isAppliedListModalOpen ? (
        <div className="guild-modal-backdrop" onClick={() => setIsAppliedListModalOpen(false)}>
          <div className="guild-modal guild-applied-modal" onClick={(event) => event.stopPropagation()}>
            <div className="guild-modal-header">
              <h3>Guild đã nộp đơn</h3>
              <button type="button" onClick={() => setIsAppliedListModalOpen(false)}>✕</button>
            </div>

            {applicationsError ? (
              <p className="guild-feedback guild-feedback--error">{applicationsError}</p>
            ) : null}
            {loadingApplications ? (
              <p className="guild-feedback">Đang tải danh sách đơn...</p>
            ) : null}

            <div className="guild-applied-list">
              {appliedGuilds.map((request) => (
                <article className="guild-applied-row" key={`applied-${request.request_id}`}>
                  <div>
                    <p className="guild-applied-name">{request.guild_name}</p>
                    <p className="guild-applied-meta">
                      Lv.{request.level} - {request.member_count}/{request.member_limit} -{' '}
                      {formatAdmission(request.admission_type)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="guild-applied-cancel-btn"
                    onClick={() => cancelMyApplication(request.request_id)}
                    disabled={cancelRequestLoadingId === request.request_id}
                  >
                    X
                  </button>
                </article>
              ))}
              {!loadingApplications && appliedGuilds.length === 0 ? (
                <p className="guild-feedback">Bạn chưa nộp đơn vào bang hội nào.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isApproveModalOpen ? (
        <div className="guild-modal-backdrop" onClick={() => setIsApproveModalOpen(false)}>
          <div className="guild-modal guild-approve-modal" onClick={(event) => event.stopPropagation()}>
            <div className="guild-modal-header">
              <h3>Danh sách user applied</h3>
              <button type="button" onClick={() => setIsApproveModalOpen(false)}>✕</button>
            </div>

            {approveListError ? (
              <p className="guild-feedback guild-feedback--error">{approveListError}</p>
            ) : null}
            {loadingApproveList ? (
              <p className="guild-feedback">Đang tải danh sách đơn...</p>
            ) : null}

            <div className="guild-approve-list">
              {pendingJoinRequests.map((request) => (
                <article className="guild-approve-row" key={`approve-${request.request_id}`}>
                  <img
                    src={request.avatar_url || '/images/character/knight_warrior.jpg'}
                    alt={getDisplayName(request, request.username || `UID ${request.user_id}`)}
                    onError={(event) => {
                      event.currentTarget.src = '/images/character/knight_warrior.jpg';
                    }}
                  />
                  <div>
                    <p className="guild-applied-name">
                      {getDisplayName(request, request.username || `UID ${request.user_id}`)}
                    </p>
                    <p className="guild-applied-meta">{memberStatusLabel(request)}</p>
                  </div>
                  <div className="guild-approve-actions">
                    <button
                      type="button"
                      className="reject"
                      onClick={() => resolveJoinRequest(request.request_id, 'reject')}
                      disabled={approvingRequestId === request.request_id}
                    >
                      X
                    </button>
                    <button
                      type="button"
                      className="accept"
                      onClick={() => resolveJoinRequest(request.request_id, 'approve')}
                      disabled={approvingRequestId === request.request_id}
                    >
                      O
                    </button>
                  </div>
                </article>
              ))}
              {!loadingApproveList && pendingJoinRequests.length === 0 ? (
                <p className="guild-feedback">Không có user nào đang chờ duyệt.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <GameDialogModal
        isOpen={Boolean(pendingKickMember)}
        onClose={() => {
          if (!kickingMemberId) setPendingKickMember(null);
        }}
        title="Xác nhận kick thành viên"
        tone="warning"
        mode="confirm"
        cancelLabel="Hủy"
        confirmLabel={kickingMemberId ? 'Đang xử lý...' : 'Kick'}
        onConfirm={kickMember}
        confirmDisabled={Boolean(kickingMemberId)}
      >
        <p>
          Bạn có chắc muốn kick{' '}
          <strong>
            {pendingKickMember
              ? getDisplayName(
                  pendingKickMember,
                  pendingKickMember.username || `UID ${pendingKickMember.user_id}`
                )
              : 'thành viên này'}
          </strong>{' '}
          khỏi bang hội không?
        </p>
      </GameDialogModal>

      <GameDialogModal
        isOpen={isDisbandModalOpen}
        onClose={() => {
          if (!disbandSubmitting) {
            setIsDisbandModalOpen(false);
            setDisbandError('');
          }
        }}
        title="Xác nhận giải tán bang hội"
        tone="error"
        mode="confirm"
        cancelLabel="Hủy"
        confirmLabel={disbandSubmitting ? 'Đang xử lý...' : 'Disband'}
        onConfirm={handleDisbandGuild}
        confirmDisabled={
          disbandSubmitting || String(disbandConfirmText || '').trim() !== String(myGuild?.name || '').trim()
        }
      >
        <div className="guild-disband-confirm-body">
          <p>
            Hành động này không thể hoàn tác. Hãy nhập chính xác tên bang hội để xác nhận disband.
          </p>
          <p>
            Guild name: <strong>{myGuild?.name}</strong>
          </p>
          <input
            type="text"
            value={disbandConfirmText}
            onChange={(event) => setDisbandConfirmText(event.target.value)}
            placeholder="Nhập tên bang hội để xác nhận..."
            disabled={disbandSubmitting}
          />
          {disbandError ? <p className="guild-feedback guild-feedback--error">{disbandError}</p> : null}
        </div>
      </GameDialogModal>
    </section>
  );
}

export default GuildPage;

