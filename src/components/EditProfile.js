import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import TemplatePage from './template/TemplatePage';
import { getDisplayName } from '../utils/userDisplay';
import './EditProfile.css';

const FALLBACK_AVATAR = '/images/character/knight_warrior.jpg';

function formatDateInput(value) {
  if (!value) return '';
  const normalized = String(value).trim();
  if (!normalized) return '';
  return normalized.slice(0, 10);
}

function EditProfile() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const navigate = useNavigate();
  const { user, isLoading, updateUserData } = useUser();

  const [form, setForm] = useState({
    username: '',
    displayName: '',
    realName: '',
    gender: '',
    birthday: '',
    avatarUrl: '',
    guild: '',
    title: '',
    ranking: '',
    peta: 0,
    petagold: 0,
  });
  const [characterOptions, setCharacterOptions] = useState([]);
  const [isPasswordBoxOpen, setIsPasswordBoxOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleState, setTitleState] = useState({ unlocked: [], equipped_title_id: null, progress: {} });

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      setLoadingProfile(true);
      setError('');
      try {
        const response = await fetch(`${API_BASE_URL}/users/${user.userId}`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || 'Không thể tải dữ liệu hồ sơ');
        }

        setForm((prev) => ({
          ...prev,
          username: data.username || '',
          displayName: data.display_name || '',
          realName: data.real_name || '',
          gender: data.gender || '',
          birthday: formatDateInput(data.birthday),
          avatarUrl: data.avatar_url || '',
          guild: data.guild || '',
          title: data.title || '',
          ranking: data.ranking || '',
          peta: Number(data.peta || 0),
          petagold: Number(data.petagold || 0),
        }));
      } catch (err) {
        setError(err.message || 'Không thể tải dữ liệu hồ sơ');
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [API_BASE_URL, isLoading, navigate, user]);

  const loadTitleState = async () => {
    if (!user?.token) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/user/titles-state`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const d = await r.json();
      if (r.ok) setTitleState(d);
    } catch (_) {}
  };

  useEffect(() => {
    if (isLoading || !user?.token) return;
    loadTitleState();
  }, [API_BASE_URL, isLoading, user?.token]);

  useEffect(() => {
    let active = true;
    const fetchAvatarOptions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/assets/character-images`);
        const data = await response.json();
        const imageOptions = Array.isArray(data?.images) ? data.images : [];
        if (!active) return;
        if (!imageOptions.length) {
          setCharacterOptions([FALLBACK_AVATAR]);
          return;
        }
        setCharacterOptions(imageOptions);
      } catch (err) {
        if (!active) return;
        setCharacterOptions([FALLBACK_AVATAR]);
      }
    };
    fetchAvatarOptions();
    return () => {
      active = false;
    };
  }, [API_BASE_URL]);

  const avatarPreview = useMemo(() => {
    const value = String(form.avatarUrl || '').trim();
    return value || FALLBACK_AVATAR;
  }, [form.avatarUrl]);

  const handleChange = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleEquipTitleChange = async (event) => {
    if (!user?.token) return;
    const raw = event.target.value;
    const titleId = raw === '' ? null : Number(raw);
    setError('');
    setSuccess('');
    setSavingTitle(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/user/equipped-title`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ titleId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Không thể đổi danh hiệu');
      const pr = await fetch(`${API_BASE_URL}/users/${user.userId}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const prof = await pr.json();
      if (pr.ok) {
        setForm((prev) => ({ ...prev, title: prof.title || '' }));
      }
      setTitleState((prev) => ({ ...prev, equipped_title_id: d.equipped_title_id ?? titleId }));
      setSuccess('Đã cập nhật danh hiệu.');
      await loadTitleState();
    } catch (err) {
      setError(err.message || 'Lỗi danh hiệu');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    setError('');
    setSuccess('');

    setSaving(true);
    try {
      const profileResponse = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          displayName: form.displayName,
          realName: form.realName,
          gender: form.gender,
          birthday: form.birthday || null,
          avatarUrl: form.avatarUrl,
        }),
      });
      const profileData = await profileResponse.json();
      if (!profileResponse.ok) {
        throw new Error(profileData?.message || 'Cập nhật hồ sơ thất bại');
      }

      updateUserData({
        username: form.username,
        displayName: form.displayName,
        effectiveName: getDisplayName({ displayName: form.displayName, username: form.username }, form.username),
      });
      setSuccess('Đã cập nhật hồ sơ.');
      navigate(`/profile/${user.userId}`);
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra khi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (key) => (event) => {
    const value = event.target.value;
    setPasswordForm((prev) => ({ ...prev, [key]: value }));
  };

  const togglePasswordVisibility = (key) => {
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChangePassword = async () => {
    if (!user) return;
    setError('');
    setSuccess('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin đổi mật khẩu.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setError('Mật khẩu mới phải từ 8 ký tự.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Xác nhận mật khẩu mới chưa khớp.');
      return;
    }

    setSavingPassword(true);
    try {
      const passwordResponse = await fetch(`${API_BASE_URL}/api/user/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const passwordData = await passwordResponse.json();
      if (!passwordResponse.ok) {
        throw new Error(passwordData?.message || 'Đổi mật khẩu thất bại');
      }

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setIsPasswordBoxOpen(false);
      setSuccess('Đổi mật khẩu thành công.');
    } catch (err) {
      setError(err.message || 'Không thể đổi mật khẩu');
    } finally {
      setSavingPassword(false);
    }
  };

  const avatarOptions = useMemo(() => {
    const all = new Set(characterOptions);
    if (form.avatarUrl) {
      all.add(form.avatarUrl);
    }
    all.add(FALLBACK_AVATAR);
    return Array.from(all);
  }, [characterOptions, form.avatarUrl]);

  if (isLoading || loadingProfile) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="edit-profile-page">
          <div className="loading">Đang tải dữ liệu hồ sơ...</div>
        </div>
      </TemplatePage>
    );
  }

  if (!user) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="edit-profile-page">
          <div className="error">Vui lòng đăng nhập.</div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="edit-profile-page">
        <div className="edit-profile-header">
          <p>Cập nhật hồ sơ</p>
        </div>

        <form className="edit-profile-grid" onSubmit={handleSubmit}>
          <section className="edit-profile-card edit-profile-card--avatar">
            <h3>Ảnh đại diện</h3>
            <img
              src={avatarPreview}
              alt="avatar preview"
              className="edit-profile-avatar-preview"
              onError={(event) => {
                event.currentTarget.src = FALLBACK_AVATAR;
              }}
            />
            <label>Chọn ảnh đại diện</label>
            <div className="edit-profile-avatar-picker-grid">
              {avatarOptions.map((avatarPath) => {
                const isActive = avatarPath === form.avatarUrl;
                return (
                  <button
                    key={avatarPath}
                    type="button"
                    className={`edit-profile-avatar-option ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, avatarUrl: avatarPath }));
                    }}
                    title={avatarPath}
                  >
                    <img
                      src={avatarPath}
                      alt="avatar option"
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_AVATAR;
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="edit-profile-card">
            <h3>Thông tin hồ sơ</h3>

            <label htmlFor="username">Username (không thể đổi)</label>
            <input id="username" type="text" value={form.username} readOnly />

            <label htmlFor="displayName">Tên hiển thị</label>
            <input
              id="displayName"
              type="text"
              value={form.displayName}
              onChange={handleChange('displayName')}
              placeholder="Để trống sẽ dùng username"
            />

            <label htmlFor="realName">Tên thật</label>
            <input
              id="realName"
              type="text"
              value={form.realName}
              onChange={handleChange('realName')}
              placeholder="Nhập tên thật"
            />

            <label htmlFor="gender">Giới tính</label>
            <select id="gender" value={form.gender} onChange={handleChange('gender')}>
              <option value="">Chưa chọn</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>

            <label htmlFor="birthday">Ngày sinh (DOB)</label>
            <input
              id="birthday"
              type="date"
              value={form.birthday}
              onChange={handleChange('birthday')}
            />
          </section>

          <section className="edit-profile-card">
            <h3>Danh hiệu</h3>
            <p className="edit-profile-hint">
              Ảnh đặt tại <code>public/images/title/</code> (vd: <code>t1.png</code>). Chỉ hiển thị các danh hiệu đã mở
              khóa.
            </p>
            <label htmlFor="equippedTitle">Trang bị danh hiệu</label>
            <select
              id="equippedTitle"
              value={titleState.equipped_title_id != null ? String(titleState.equipped_title_id) : ''}
              onChange={handleEquipTitleChange}
              disabled={savingTitle}
            >
              <option value="">— Không —</option>
              {(titleState.unlocked || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {titleState.progress && (
              <p className="edit-profile-title-progress">
                <small>
                  Tiến độ: kiếm {Number(titleState.progress.peta_earned || 0).toLocaleString()} peta · tiêu{' '}
                  {Number(titleState.progress.peta_spent || 0).toLocaleString()} · bắt {titleState.progress.pets_caught || 0}{' '}
                  pet · tiến hóa {titleState.progress.pet_evolutions || 0} · thắng quái {titleState.progress.hunt_wins || 0}
                </small>
              </p>
            )}
          </section>

          <section className="edit-profile-card">
            <h3>Đổi mật khẩu</h3>
            {!isPasswordBoxOpen ? (
              <>
                <p className="edit-profile-password-note">Nhấn nút bên dưới nếu bạn muốn đổi mật khẩu.</p>
                <button
                  type="button"
                  className="edit-profile-btn edit-profile-btn--primary"
                  onClick={() => setIsPasswordBoxOpen(true)}
                >
                  Đổi mật khẩu
                </button>
              </>
            ) : (
              <>
                <label htmlFor="currentPassword">Mật khẩu hiện tại</label>
                <div className="edit-profile-password-row">
                  <input
                    id="currentPassword"
                    type={showPassword.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange('currentPassword')}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="edit-profile-eye-btn"
                    onClick={() => togglePasswordVisibility('current')}
                    aria-label="Hiện hoặc ẩn mật khẩu hiện tại"
                  >
                    {showPassword.current ? '🙈' : '👁'}
                  </button>
                </div>

                <label htmlFor="newPassword">Mật khẩu mới</label>
                <div className="edit-profile-password-row">
                  <input
                    id="newPassword"
                    type={showPassword.next ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange('newPassword')}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="edit-profile-eye-btn"
                    onClick={() => togglePasswordVisibility('next')}
                    aria-label="Hiện hoặc ẩn mật khẩu mới"
                  >
                    {showPassword.next ? '🙈' : '👁'}
                  </button>
                </div>

                <label htmlFor="confirmPassword">Nhập lại mật khẩu mới</label>
                <div className="edit-profile-password-row">
                  <input
                    id="confirmPassword"
                    type={showPassword.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange('confirmPassword')}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="edit-profile-eye-btn"
                    onClick={() => togglePasswordVisibility('confirm')}
                    aria-label="Hiện hoặc ẩn xác nhận mật khẩu mới"
                  >
                    {showPassword.confirm ? '🙈' : '👁'}
                  </button>
                </div>

                <div className="edit-profile-password-actions">
                  <button
                    type="button"
                    className="edit-profile-btn edit-profile-btn--primary"
                    onClick={handleChangePassword}
                    disabled={savingPassword}
                  >
                    {savingPassword ? 'Đang đổi...' : 'Xác nhận'}
                  </button>
                  <button
                    type="button"
                    className="edit-profile-btn"
                    onClick={() => {
                      setIsPasswordBoxOpen(false);
                      setPasswordForm({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                      });
                    }}
                  >
                    Hủy
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="edit-profile-card">
            <h3>Thông tin tài khoản</h3>
            <p><strong>Bang hội:</strong> {form.guild || 'Chưa có'}</p>
            <p><strong>Danh hiệu:</strong> {form.title || 'Chưa có'}</p>
            <p><strong>Hạng:</strong> {form.ranking || 'Chưa có'}</p>
            <p><strong>Peta:</strong> {Number(form.peta || 0).toLocaleString()}</p>
            <p><strong>PetaGold:</strong> {Number(form.petagold || 0).toLocaleString()}</p>
          </section>

          {(error || success) && (
            <section className="edit-profile-card edit-profile-feedback">
              {error && <p className="edit-profile-error">{error}</p>}
              {success && <p className="edit-profile-success">{success}</p>}
            </section>
          )}

          <section className="edit-profile-actions">
            <button type="submit" className="edit-profile-btn edit-profile-btn--primary" disabled={saving}>
              {saving ? 'Đang cập nhật...' : 'Cập nhật thông tin'}
            </button>
            <button
              type="button"
              className="edit-profile-btn"
              onClick={() => navigate(`/profile/${user.userId}`)}
            >
              Xem hồ sơ nhân vật
            </button>
            <button
              type="button"
              className="edit-profile-btn"
              onClick={() => navigate('/')}
            >
              Quay về trang chủ
            </button>
          </section>
        </form>
      </div>
    </TemplatePage>
  );
}

export default EditProfile;
