import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import {
  GUILD_BANNER_PRESETS,
  getPresetById,
  getBannerPresentation,
} from '../utils/guildBanners';
import './CreateGuildPage.css';

function CreateGuildPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const navigate = useNavigate();
  const { user } = useUser();

  const [form, setForm] = useState({
    name: '',
    description: '',
    admissionType: 'free',
    bannerPreset: GUILD_BANNER_PRESETS[0].id,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const previewBanner = useMemo(
    () => getBannerPresentation(getPresetById(form.bannerPreset).imageUrl),
    [form.bannerPreset]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.token) {
      navigate('/login');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        name: form.name,
        description: form.description,
        admissionType: form.admissionType,
        bannerUrl: getPresetById(form.bannerPreset).imageUrl,
      };
      const response = await fetch(`${API_BASE_URL}/api/guilds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Không thể tạo bang hội');
      navigate('/guild');
    } catch (err) {
      setError(err.message || 'Không thể tạo bang hội');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="create-guild-page">
      <h2>Tạo Bang Hội</h2>
      <p className="create-guild-subtitle">
        Bang hội mới bắt đầu với 10 thành viên. Khi tăng level, sức chứa tăng dần và tối đa 30 ở Lv.10.
      </p>

      <form className="create-guild-form" onSubmit={handleSubmit}>
        <div className="create-guild-preview">
          <div className="create-guild-banner" style={previewBanner.style} />
          <div className="create-guild-preview-text">
            <strong>Banner Preview</strong>
            <span>Chọn banner từ danh sách có sẵn.</span>
          </div>
        </div>

        <div className="create-guild-presets">
          {GUILD_BANNER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`create-guild-preset ${form.bannerPreset === preset.id ? 'active' : ''}`}
              style={{
                backgroundImage: `url(${preset.imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              onClick={() => setForm((prev) => ({ ...prev, bannerPreset: preset.id }))}
            >
              {preset.id}
            </button>
          ))}
        </div>

        <label className="create-guild-label">
          Tên bang hội
          <input
            type="text"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Nhập tên bang hội..."
            maxLength={60}
            required
          />
        </label>

        <label className="create-guild-label">
          Mô tả bang hội
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            rows={4}
            maxLength={600}
            placeholder="Giới thiệu về mục tiêu, phong cách hoạt động của bang hội..."
          />
        </label>

        <label className="create-guild-label">
          Admission Type
          <select
            value={form.admissionType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, admissionType: event.target.value }))
            }
          >
            <option value="free">Tự do gia nhập</option>
            <option value="approval">Cần phê duyệt</option>
          </select>
        </label>

        {error ? <p className="create-guild-error">{error}</p> : null}

        <div className="create-guild-actions">
          <button type="button" onClick={() => navigate('/guild')} disabled={submitting}>
            Quay lại danh sách
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Đang tạo...' : 'Tạo Bang Hội'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default CreateGuildPage;

