import React, { useEffect, useMemo, useState } from 'react';
import './TaxonomyFilterModal.css';

/**
 * Modal bộ lọc dạng pill nhiều section (type / category / subtype, …).
 * Mỗi section: multi-select; mảng rỗng = không lọc theo section đó.
 *
 * @typedef {{ id: string; title: string; options: { value: string; label: string }[] }} FilterSection
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} [props.title]
 * @param {FilterSection[]} props.sections
 * @param {Record<string, string[]>} props.value — sectionId → các value đang chọn (rỗng = tất cả)
 * @param {(next: Record<string, string[]>) => void} props.onApply
 */

function emptySelectionForSections(sections) {
  return sections.reduce((acc, s) => {
    acc[s.id] = [];
    return acc;
  }, {});
}

export default function TaxonomyFilterModal({
  open,
  onClose,
  title = 'Bộ lọc',
  sections = [],
  value,
  onApply,
}) {
  const baseline = useMemo(() => emptySelectionForSections(sections), [sections]);

  const [draft, setDraft] = useState(() => ({ ...baseline, ...value }));

  useEffect(() => {
    if (!open) return;
    const next = { ...baseline };
    sections.forEach((s) => {
      next[s.id] = Array.isArray(value?.[s.id]) ? [...value[s.id]] : [];
    });
    setDraft(next);
  }, [open, sections, value, baseline]);

  if (!open) return null;

  const toggle = (sectionId, optionValue) => {
    setDraft((prev) => {
      const cur = prev[sectionId] || [];
      const has = cur.includes(optionValue);
      const nextArr = has ? cur.filter((v) => v !== optionValue) : [...cur, optionValue];
      return { ...prev, [sectionId]: nextArr };
    });
  };

  const clearSection = (sectionId) => {
    setDraft((prev) => ({ ...prev, [sectionId]: [] }));
  };

  const handleReset = () => {
    setDraft({ ...baseline });
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const activeCount = sections.reduce((n, s) => n + (draft[s.id]?.length || 0), 0);

  return (
    <div className="taxonomy-filter-overlay" role="presentation" onClick={onClose}>
      <div
        className="taxonomy-filter-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="taxonomy-filter-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="taxonomy-filter-header">
          <h2 id="taxonomy-filter-title">{title}</h2>
          <button type="button" className="taxonomy-filter-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>

        <div className="taxonomy-filter-body">
          {sections.map((section) => (
            <section key={section.id} className="taxonomy-filter-section">
              <div className="taxonomy-filter-section-title">
                <span>{section.title}</span>
              </div>
              <div className="taxonomy-filter-pills">
                <button
                  type="button"
                  className={`taxonomy-filter-pill taxonomy-filter-pill-all ${(draft[section.id] || []).length === 0 ? 'is-active' : ''}`}
                  onClick={() => clearSection(section.id)}
                >
                  Tất cả
                </button>
                {section.options.map((opt) => {
                  const selected = (draft[section.id] || []).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`taxonomy-filter-pill ${selected ? 'is-active' : ''}`}
                      onClick={() => toggle(section.id, opt.value)}
                    >
                      {selected && <span className="taxonomy-filter-check" aria-hidden>✓</span>}
                      <span className="taxonomy-filter-pill-label">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <footer className="taxonomy-filter-footer">
          <button type="button" className="taxonomy-filter-btn taxonomy-filter-btn-reset" onClick={handleReset}>
            Đặt lại
          </button>
          <div className="taxonomy-filter-footer-right">
            {activeCount > 0 && (
              <span className="taxonomy-filter-active-hint">{activeCount} tiêu chí</span>
            )}
            <button type="button" className="taxonomy-filter-btn taxonomy-filter-btn-apply" onClick={handleApply}>
              Áp dụng
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/**
 * Helper: lọc mảng object theo taxonomy (AND giữa các trường).
 * @param {object[]} rows
 * @param {Record<string, string[]>} selection — key = field name trên row (vd type, category, subtype)
 */
export function filterByTaxonomySelection(rows, selection, fieldMap) {
  if (!rows?.length) return rows;
  const entries = Object.entries(fieldMap || {}).filter(([sectionId]) => selection[sectionId]?.length);
  if (!entries.length) return rows;
  return rows.filter((row) =>
    entries.every(([sectionId, field]) => {
      const allowed = selection[sectionId];
      if (!allowed?.length) return true;
      const v = row[field];
      const str = v == null || v === '' ? '' : String(v);
      return allowed.includes(str);
    })
  );
}
