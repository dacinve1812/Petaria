import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import {
  FRACTION_NONE_ID,
  GUILD_BANNER_PRESETS,
  GUILD_FRACTION_PRESETS,
  getBannerPresentation,
  getFractionPresetById,
  getPresetById,
  parseGuildVisualValue,
  serializeGuildVisualValue,
} from '../utils/guildBanners';
import './GuildPage.css';
import './EditGuildPage.css';

const GUILD_RENAME_COST = 1000000;

function EditGuildPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const navigate = useNavigate();
  const { user, isLoading } = useUser();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [myGuild, setMyGuild] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    admissionType: 'free',
    bannerPreset: GUILD_BANNER_PRESETS[0].id,
    fractionPreset: FRACTION_NONE_ID,
  });

  const fetchMyGuild = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/guilds`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể tải thông tin guild');
      setMyGuild(data?.myGuild || null);
    } catch (err) {
      setError(err.message || 'Không thể tải thông tin guild');
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
    fetchMyGuild();
  }, [fetchMyGuild, isLoading, navigate, user?.token]);

  useEffect(() => {
    if (!myGuild) return;
    const visualValue = parseGuildVisualValue(String(myGuild.banner_url || '').trim());
    setEditForm({
      name: myGuild.name || '',
      description: myGuild.description || '',
      admissionType: myGuild.admission_type || 'free',
      bannerPreset: visualValue.banner.id,
      fractionPreset: visualValue.fraction.id,
    });
  }, [myGuild]);

  const isGuildOwner = Number(myGuild?.owner_user_id) === Number(user?.userId);
  const canEdit = Boolean(myGuild) && isGuildOwner;

  const preview = useMemo(() => {
    const bannerUrl = getPresetById(editForm.bannerPreset).imageUrl;
    const fractionUrl = getFractionPresetById(editForm.fractionPreset).imageUrl;
    return getBannerPresentation(serializeGuildVisualValue({ bannerUrl, fractionUrl }));
  }, [editForm.bannerPreset, editForm.fractionPreset]);

  const willRenameGuild =
    String(editForm.name || '').trim().toLowerCase() !== String(myGuild?.name || '').trim().toLowerCase();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canEdit || !user?.token) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: editForm.name,
        description: editForm.description,
        admissionType: editForm.admissionType,
        bannerUrl: serializeGuildVisualValue({
          bannerUrl: getPresetById(editForm.bannerPreset).imageUrl,
          fractionUrl: getFractionPresetById(editForm.fractionPreset).imageUrl,
        }),
      };
      const response = await fetch(`${API_BASE_URL}/api/guilds/my`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể cập nhật guild');
      navigate('/guild');
    } catch (err) {
      setError(err.message || 'Không thể cập nhật guild');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-content edit-guild-page">
      <div className="edit-guild-top">
        <h2>Edit Guild</h2>
        <button type="button" onClick={() => navigate('/guild')}>
          Quay lại Guild
        </button>
      </div>

      {loading ? <p className="guild-feedback">Đang tải thông tin guild...</p> : null}
      {error ? <p className="guild-feedback guild-feedback--error">{error}</p> : null}

      {!loading && !myGuild ? (
        <p className="guild-feedback guild-feedback--error">Bạn chưa tham gia guild nào để chỉnh sửa.</p>
      ) : null}
      {!loading && myGuild && !isGuildOwner ? (
        <p className="guild-feedback guild-feedback--error">Chỉ Leader mới có quyền chỉnh sửa guild.</p>
      ) : null}

      {canEdit ? (
        <form className="edit-guild-card" onSubmit={handleSubmit}>
          <div className="guild-edit-preview" style={preview.style} />
          <p className="guild-edit-banner-note">Banner preview</p>

          <div className="guild-edit-presets">
            <div className="guild-edit-preset-panel">
              <p>Banner</p>
              <div className="guild-edit-preset-grid">
                {GUILD_BANNER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={editForm.bannerPreset === preset.id ? 'active' : ''}
                    onClick={() => setEditForm((prev) => ({ ...prev, bannerPreset: preset.id }))}
                  >
                    <span
                      className="guild-edit-preset-thumb"
                      style={{ backgroundImage: `url(${preset.imageUrl})` }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="guild-edit-preset-panel">
              <p>Fraction</p>
              <div className="guild-edit-preset-grid">
                {GUILD_FRACTION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={editForm.fractionPreset === preset.id ? 'active' : ''}
                    onClick={() => setEditForm((prev) => ({ ...prev, fractionPreset: preset.id }))}
                  >
                    <span
                      className={`guild-edit-preset-thumb guild-edit-preset-thumb--fraction ${
                        !preset.imageUrl ? 'is-none' : ''
                      }`}
                      style={preset.imageUrl ? { backgroundImage: `url(${preset.imageUrl})` } : undefined}
                    >
                      {!preset.imageUrl ? 'None' : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="guild-edit-label">
            Guild name
            <input
              type="text"
              maxLength={60}
              value={editForm.name}
              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>

          <label className="guild-edit-label">
            Description
            <textarea
              rows={4}
              maxLength={600}
              value={editForm.description}
              onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>

          <label className="guild-edit-label">
            Admission Type
            <select
              value={editForm.admissionType}
              onChange={(event) => setEditForm((prev) => ({ ...prev, admissionType: event.target.value }))}
            >
              <option value="free">Free to Join</option>
              <option value="approval">Needs Approval</option>
            </select>
          </label>

          {willRenameGuild ? (
            <p className="guild-edit-rename-cost">
              Đổi tên guild sẽ tốn <strong>{GUILD_RENAME_COST.toLocaleString('vi-VN')} Peta</strong>.
            </p>
          ) : (
            <p className="guild-edit-rename-cost">
              Chỉnh sửa mô tả/banner/admission type sẽ không tốn Peta.
            </p>
          )}

          <div className="guild-edit-actions">
            <button type="button" onClick={() => navigate('/guild')} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export default EditGuildPage;
