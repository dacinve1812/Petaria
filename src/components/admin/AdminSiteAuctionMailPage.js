import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminSiteAuctionMailPage.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function AdminSiteAuctionMailPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [auctionMailLocale, setAuctionMailLocale] = useState('vi');
  const [auctionMailTemplates, setAuctionMailTemplates] = useState([]);
  const [auctionMailLoading, setAuctionMailLoading] = useState(false);
  const [auctionMailSaving, setAuctionMailSaving] = useState(false);
  const [auctionMailError, setAuctionMailError] = useState('');

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  const loadAuctionMailTemplates = useCallback(async (loc) => {
    if (!user?.token) {
      setAuctionMailError('Cần đăng nhập admin.');
      return;
    }
    setAuctionMailLoading(true);
    setAuctionMailError('');
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/admin/site/auction-mail-templates?locale=${encodeURIComponent(loc)}`,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setAuctionMailTemplates((data.templates || []).map((t) => ({ ...t })));
    } catch (e) {
      console.error(e);
      setAuctionMailError(e.message || 'Không tải được template');
      setAuctionMailTemplates([]);
    } finally {
      setAuctionMailLoading(false);
    }
  }, [user?.token]);

  useEffect(() => {
    if (!user?.isAdmin) return undefined;
    loadAuctionMailTemplates(auctionMailLocale);
    return undefined;
  }, [user?.isAdmin, auctionMailLocale, loadAuctionMailTemplates]);

  const saveAuctionMailTemplates = async () => {
    if (!user?.token) return;
    setAuctionMailSaving(true);
    setAuctionMailError('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/admin/site/auction-mail-templates`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          locale: auctionMailLocale,
          templates: auctionMailTemplates.map(({ template_key, subject, message }) => ({
            template_key,
            subject,
            message,
          })),
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || err.details || `HTTP ${r.status}`);
      }
      alert('Đã lưu template thư đấu giá.');
      await loadAuctionMailTemplates(auctionMailLocale);
    } catch (e) {
      console.error(e);
      setAuctionMailError(e.message || 'Lỗi lưu');
    } finally {
      setAuctionMailSaving(false);
    }
  };

  const updateAuctionMailTemplate = (templateKey, field, value) => {
    setAuctionMailTemplates((prev) =>
      prev.map((t) => (t.template_key === templateKey ? { ...t, [field]: value } : t))
    );
  };

  if (isLoading) {
    return <div className="admin-site-auction-mail-page">Loading...</div>;
  }
  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className="admin-site-auction-mail-page">
      <div className="admin-site-auction-mail-header">
        <h1>Quản lý Site — Thư đấu giá</h1>
        <div className="admin-site-auction-mail-nav">
          <Link to="/admin/site-management" className="back-btn">
            ← Quản lý Homepage
          </Link>
          <button type="button" className="back-btn" onClick={() => navigate('/admin')}>
            Admin Panel
          </button>
        </div>
      </div>

      <div className="auction-mail-site-tab">
        <div className="auction-mail-site-intro">
          <h2>Nội dung thư hệ thống (đấu giá)</h2>
          <p>
            Chỉnh tiêu đề và nội dung theo từng sự kiện. Placeholder: <code>{'{{item_name}}'}</code>,{' '}
            <code>{'{{amount_fmt}}'}</code>, <code>{'{{currency_label}}'}</code>. Chưa lưu CSDL thì server dùng bản
            mặc định trong code. Biến môi trường <code>AUCTION_MAIL_LOCALE</code> (vi | en) quyết định ngôn ngữ khi gửi
            thư từ game. Người chơi theo dõi đặt giá trong MyAuction — không gửi thư xác nhận từng lần bid.
          </p>
        </div>
        {auctionMailError ? <p className="auction-mail-site-error">{auctionMailError}</p> : null}
        <div className="auction-mail-locale-bar">
          <span>Ngôn ngữ chỉnh sửa:</span>
          <button
            type="button"
            className={auctionMailLocale === 'vi' ? 'locale-pill active' : 'locale-pill'}
            onClick={() => setAuctionMailLocale('vi')}
          >
            Tiếng Việt
          </button>
          <button
            type="button"
            className={auctionMailLocale === 'en' ? 'locale-pill active' : 'locale-pill'}
            onClick={() => setAuctionMailLocale('en')}
          >
            English
          </button>
          <button
            type="button"
            className="save-navbar-btn"
            onClick={() => saveAuctionMailTemplates()}
            disabled={auctionMailSaving || auctionMailLoading || !user?.token}
          >
            {auctionMailSaving ? 'Đang lưu…' : 'Lưu tất cả template (locale hiện tại)'}
          </button>
          <button
            type="button"
            className="cancel-btn"
            onClick={() => loadAuctionMailTemplates(auctionMailLocale)}
            disabled={auctionMailLoading}
          >
            Tải lại
          </button>
        </div>
        {auctionMailLoading ? (
          <p>Đang tải template…</p>
        ) : (
          <div className="auction-mail-template-list">
            {auctionMailTemplates.map((t) => (
              <div key={t.template_key} className="auction-mail-template-card">
                <div className="auction-mail-template-head">
                  <h3>{t.label}</h3>
                  <code className="auction-mail-template-key">{t.template_key}</code>
                  {t.usesDatabase ? (
                    <span className="auction-mail-badge">Đã tùy chỉnh DB</span>
                  ) : (
                    <span className="auction-mail-badge muted">Mặc định</span>
                  )}
                </div>
                <p className="auction-mail-placeholders">
                  Placeholder: <code>{(t.placeholders || []).map((p) => `{{${p}}}`).join(', ')}</code>
                </p>
                <label className="auction-mail-field-label">Tiêu đề</label>
                <input
                  type="text"
                  className="auction-mail-input-subject"
                  value={t.subject || ''}
                  onChange={(e) => updateAuctionMailTemplate(t.template_key, 'subject', e.target.value)}
                  maxLength={500}
                />
                <label className="auction-mail-field-label">Nội dung</label>
                <textarea
                  className="auction-mail-textarea-message"
                  value={t.message || ''}
                  onChange={(e) => updateAuctionMailTemplate(t.template_key, 'message', e.target.value)}
                  rows={6}
                  spellCheck={false}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminSiteAuctionMailPage;
