import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TemplatePage from './template/TemplatePage';
import { getDisplayName } from '../utils/userDisplay';
import { getBannerPresentation } from '../utils/guildBanners';
import './StatisticsPage.css';

const FALLBACK_AVATAR = '/images/character/knight_warrior.jpg';
const FALLBACK_PET = '/images/placeholder.png';
const TOP_N = 10;

/** Dùng dấu phẩy: 97,422,783 */
function formatNumber(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US');
}

function petImageSrc(image) {
  if (!image) return FALLBACK_PET;
  if (String(image).startsWith('/')) return image;
  return `/images/pets/${image}`;
}

function padTop10(rows, keyPrefix) {
  const list = (Array.isArray(rows) ? rows : []).slice(0, TOP_N).map((row, i) => ({
    ...row,
    _key: row._key || `${keyPrefix}-${row.user_id || row.pet_uuid || i}`,
    _empty: false,
  }));
  while (list.length < TOP_N) {
    list.push({ _key: `${keyPrefix}-empty-${list.length}`, _empty: true });
  }
  return list;
}

function GuildCell({ guildName, bannerUrl }) {
  if (!guildName) {
    return <span className="stats-guild stats-guild--empty">—</span>;
  }
  const presentation = getBannerPresentation(bannerUrl);
  return (
    <div className="stats-guild">
      <span
        className="stats-guild-banner"
        style={presentation.style}
        title={guildName}
        aria-hidden
      />
      <Link to={`/guild/${encodeURIComponent(guildName)}`} className="stats-guild-name">
        {guildName}
      </Link>
    </div>
  );
}

function RankingTable({ title, columns, rows, renderCell, tableClass = '' }) {
  return (
    <section className={`stats-rank-block ${tableClass}`}>
      <h3 className="stats-rank-title">{title}</h3>
      <div className="stats-rank-table">
        <div className="stats-rank-header">
          {columns.map((col) => (
            <div
              key={col.key}
              className={`stats-rank-header-cell stats-rank-header-cell--${col.key}`}
            >
              {col.label}
            </div>
          ))}
        </div>
        <div className="stats-rank-body">
          {rows.map((row, index) => {
            const rank = index + 1;
            const rankClass =
              rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-n';
            const emptyClass = row._empty ? 'is-empty' : '';
            return (
              <div
                key={row._key || index}
                className={`stats-rank-row ${rankClass} ${emptyClass}`}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={`stats-rank-cell stats-rank-cell--${col.key}`}
                    data-label={col.label}
                  >
                    {renderCell(col.key, row, rank)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StatisticsPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/statistics`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || body.message || 'Không tải được số liệu');
        return body;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Lỗi kết nối');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL]);

  const website = data?.website || {};
  const highlights = data?.petHighlights || {};

  const highlightRows = [
    { label: 'Đẳng cấp cao nhất', entry: highlights.highestLevel },
    { label: 'Sức mạnh cao nhất', entry: highlights.highestStr },
    { label: 'Thông minh nhất', entry: highlights.smartest },
    { label: 'Tốc độ nhanh nhất', entry: highlights.fastest },
    { label: 'Phòng thủ tốt nhất', entry: highlights.bestDef },
    { label: 'Điểm kinh nghiệm cao nhất', entry: highlights.highestExp },
    { label: 'Đơn đấu thắng nhiều nhất', entry: highlights.mostWins },
  ];

  const topPets = padTop10(data?.topPetsByLevel, 'pet');
  const topCash = padTop10(data?.topCash, 'cash');
  const topBank = padTop10(data?.topBank, 'bank');
  const topGold = padTop10(data?.topPetagold, 'gold');

  const userColumns = [
    { key: 'rank', label: 'Rank' },
    { key: 'nickname', label: 'Nickname' },
    { key: 'guild', label: 'Guild' },
    { key: 'metric', label: 'Peta' },
  ];

  const renderUserCell = (metricKey, iconSrc) => (key, row, rank) => {
    if (key === 'rank') {
      return <span className="stats-rank-num">{rank}</span>;
    }
    if (row._empty) {
      if (key === 'nickname') return <span className="stats-placeholder">—</span>;
      if (key === 'guild') return <span className="stats-placeholder">—</span>;
      if (key === 'metric') return <span className="stats-placeholder">—</span>;
      return null;
    }
    if (key === 'nickname') {
      const name = getDisplayName(row, row.username || '—');
      return (
        <div className="stats-identity">
          <img
            className="stats-avatar"
            src={row.avatar_url || FALLBACK_AVATAR}
            alt=""
            onError={(e) => {
              e.currentTarget.src = FALLBACK_AVATAR;
            }}
          />
          {row.user_id ? <Link to={`/profile/${row.user_id}`}>{name}</Link> : <span>{name}</span>}
        </div>
      );
    }
    if (key === 'guild') {
      return <GuildCell guildName={row.guild} bannerUrl={row.guild_banner_url} />;
    }
    if (key === 'metric') {
      return (
        <span className="stats-metric stats-metric--currency">
          <img src={iconSrc} alt="" />
          {formatNumber(row[metricKey])}
        </span>
      );
    }
    return null;
  };

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="statistics-page">
        {loading ? <p className="stats-loading">Đang tải số liệu…</p> : null}
        {error ? <p className="stats-error">{error}</p> : null}

        {!loading && !error && (
          <>
            <section className="stats-overview">
              <div className="stats-overview-banner">
                <h2>Số liệu website</h2>
              </div>
              <div className="stats-overview-grid">
                <div className="stats-overview-col">
                  <h3>Trình trạng website</h3>
                  <ul className="stats-overview-list">
                    <li>
                      Petaria có tổng cộng <strong>{formatNumber(website.members) || '0'}</strong> thành
                      viên
                    </li>
                    <li>
                      Có <strong>{formatNumber(website.vipAccounts) || '0'}</strong> Tài khoản VIP
                    </li>
                    <li>
                      Petaria có tổng cộng <strong>{formatNumber(website.itemTypes) || '0'}</strong> loại
                      vật phẩm
                    </li>
                    <li>
                      Petaria có tổng cộng <strong>{formatNumber(website.shops) || '0'}</strong> Cửa hàng
                    </li>
                    <li>
                      Petaria có tổng cộng <strong>{formatNumber(website.clubs) || '0'}</strong> Câu lạc bộ
                    </li>
                    <li>
                      Petaria có tổng cộng <strong>{formatNumber(website.exhibitions) || '0'}</strong>{' '}
                      Phòng triển lãm
                    </li>
                    <li>
                      Petaria có tổng cộng <strong>{formatNumber(website.spiritTypes) || '0'}</strong> loại
                      linh thú
                    </li>
                    <li>
                      Petaria có tổng cộng <strong>{formatNumber(website.petTypes) || '0'}</strong> loại thú
                      cưng
                    </li>
                    <li>
                      Petaria có tổng cộng <strong>{formatNumber(website.evolutionForms) || '0'}</strong>{' '}
                      dạng tiến hóa thú cưng
                    </li>
                  </ul>
                </div>
                <div className="stats-overview-col">
                  <h3>Trình trạng Thú cưng</h3>
                  <ul className="stats-overview-list">
                    {highlightRows.map((row) => (
                      <li key={row.label}>
                        {row.label}:{' '}
                        {row.entry?.pet_uuid ? (
                          <Link to={`/pet/${row.entry.pet_uuid}`} className="stats-pet-link">
                            {row.entry.pet_name || '—'}
                          </Link>
                        ) : (
                          <span>{row.entry?.pet_name || '—'}</span>
                        )}{' '}
                        <span className="stats-highlight-value">
                          [{formatNumber(row.entry?.value) || '0'}]
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <RankingTable
              title="Top 10 thú cưng đẳng cấp cao nhất"
              tableClass="stats-rank-block--pets"
              columns={[
                { key: 'rank', label: 'Rank' },
                { key: 'pet', label: 'Pet' },
                { key: 'species', label: 'Loài' },
                { key: 'level', label: 'Level' },
                { key: 'owner', label: 'Owner' },
              ]}
              rows={topPets}
              renderCell={(key, row, rank) => {
                if (key === 'rank') return <span className="stats-rank-num">{rank}</span>;
                if (row._empty) return <span className="stats-placeholder">—</span>;
                if (key === 'pet') {
                  return (
                    <div className="stats-identity">
                      <img
                        className="stats-avatar"
                        src={petImageSrc(row.species_image)}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_PET;
                        }}
                      />
                      {row.pet_uuid ? (
                        <Link to={`/pet/${row.pet_uuid}`}>{row.pet_name}</Link>
                      ) : (
                        <span>{row.pet_name}</span>
                      )}
                    </div>
                  );
                }
                if (key === 'species') return <span>{row.species_name || '—'}</span>;
                if (key === 'level') {
                  return <span className="stats-metric">{formatNumber(row.level)}</span>;
                }
                if (key === 'owner') {
                  const name = getDisplayName(
                    { display_name: row.owner_display_name, username: row.username },
                    row.owner_name || row.username || '—'
                  );
                  return row.owner_id ? (
                    <Link to={`/profile/${row.owner_id}`}>{name}</Link>
                  ) : (
                    name
                  );
                }
                return null;
              }}
            />

            <RankingTable
              title="Top 10 phú hộ (tiền mặt)"
              tableClass="stats-rank-block--users"
              columns={userColumns.map((c) =>
                c.key === 'metric' ? { ...c, label: 'Peta' } : c
              )}
              rows={topCash}
              renderCell={renderUserCell('peta', '/images/icons/peta.png')}
            />

            <RankingTable
              title="Top 10 phú hộ (ngân hàng)"
              tableClass="stats-rank-block--users"
              columns={userColumns.map((c) =>
                c.key === 'metric' ? { ...c, label: 'Peta' } : c
              )}
              rows={topBank}
              renderCell={renderUserCell('peta', '/images/icons/peta.png')}
            />

            <RankingTable
              title="Top 10 phú hộ (PetaGold)"
              tableClass="stats-rank-block--users"
              columns={userColumns.map((c) =>
                c.key === 'metric' ? { ...c, label: 'PetaGold' } : c
              )}
              rows={topGold}
              renderCell={renderUserCell('petagold', '/images/icons/petagold.png')}
            />
          </>
        )}
      </div>
    </TemplatePage>
  );
}

export default StatisticsPage;
