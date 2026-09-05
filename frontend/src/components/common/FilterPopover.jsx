import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * FilterPopover component for desktop table column filtering.
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - title: string
 * - type: 'text' | 'daterange' | 'multiselect'
 * - value: any (string for text, {from, to} for daterange, Array<string> for multiselect)
 * - onChange: (newValue: any) => void
 * - options: Array<{ label: string, value: string }> (for multiselect)
 * - sortConfig: { key: string|null, direction: 'asc'|'desc' }
 * - columnKey: string
 * - onSort: (direction: 'asc'|'desc') => void
 * - sortAscLabel: string
 * - sortDescLabel: string
 * - sortFields: Array<{ key: string, label: string }>
 * - activeSortField: string
 * - onSortFieldChange: (fieldKey: string) => void
 */
export function FilterPopover({
  isOpen,
  onClose,
  title,
  type,
  value,
  onChange,
  options = [],
  sortConfig,
  columnKey,
  onSort,
  sortAscLabel,
  sortDescLabel,
  sortFields,
  activeSortField,
  onSortFieldChange
}) {
  const popoverRef = useRef(null);
  const anchorRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [positioned, setPositioned] = useState(false);

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const parentEl = anchorRef.current.parentElement;
    if (!parentEl) return;
    const rect = parentEl.getBoundingClientRect();

    let top = rect.bottom + 4;
    let left = rect.left;

    if (popoverRef.current) {
      const popoverWidth = popoverRef.current.offsetWidth || 260;
      const popoverHeight = popoverRef.current.offsetHeight || 300;

      // Ensure popover stays within right viewport edge
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }

      // Ensure popover stays within left viewport edge
      if (left < 16) {
        left = 16;
      }

      // Ensure popover flips above header if extending below bottom viewport edge
      if (top + popoverHeight > window.innerHeight - 16 && rect.top - popoverHeight > 16) {
        top = rect.top - popoverHeight - 4;
      }
    }

    setCoords({ top, left });
    setPositioned(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPositioned(false);
      return;
    }

    updatePosition();

    function handleClickOutside(event) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        anchorRef.current?.parentElement &&
        !anchorRef.current.parentElement.contains(event.target)
      ) {
        onClose();
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, onClose, updatePosition]);

  // Reset local search term when popover opens/closes
  useEffect(() => {
    if (!isOpen) setSearchTerm('');
  }, [isOpen]);

  const visibleOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const lower = searchTerm.toLowerCase();
    return options.filter(opt => opt.label.toLowerCase().includes(lower) || (opt.value && String(opt.value).toLowerCase().includes(lower)));
  }, [options, searchTerm]);

  const { enabledOptions, disabledOptions } = useMemo(() => {
    const enabled = [];
    const disabled = [];
    visibleOptions.forEach(opt => {
      if (opt.disabled) disabled.push(opt);
      else enabled.push(opt);
    });
    return { enabledOptions: enabled, disabledOptions: disabled };
  }, [visibleOptions]);

  const isSortedAsc = sortConfig?.key === columnKey && sortConfig?.direction === 'asc';
  const isSortedDesc = sortConfig?.key === columnKey && sortConfig?.direction === 'desc';

  const handleMultiselectToggle = (optVal) => {
    const current = (!value || value.length === 0) ? options.map(o => o.value) : value;
    let next;
    if (current.includes(optVal)) {
      next = current.filter(v => v !== optVal);
    } else {
      next = [...current, optVal];
    }

    if (next.length === options.length) {
      onChange([]);
    } else {
      onChange(next);
    }
  };

  const handleSelectAll = () => {
    if (!searchTerm.trim()) {
      onChange([]);
    } else {
      const current = (!value || value.length === 0) ? options.map(o => o.value) : value;
      const visibleValues = visibleOptions.map(o => o.value);
      const combined = Array.from(new Set([...current, ...visibleValues]));
      if (combined.length === options.length) {
        onChange([]);
      } else {
        onChange(combined);
      }
    }
  };

  const handleClearMultiselect = () => {
    if (!searchTerm.trim()) {
      onChange([]);
    } else {
      const visibleValues = visibleOptions.map(o => o.value);
      const current = (!value || value.length === 0) ? options.map(o => o.value) : value;
      const next = current.filter(v => !visibleValues.includes(v));
      onChange(next.length === 0 ? [] : next);
    }
  };

  if (!isOpen) {
    return <span ref={anchorRef} style={{ display: 'none' }} />;
  }

  const popoverContent = (
    <div
      ref={popoverRef}
      className="filter-popover glass-card"
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 1000,
        opacity: positioned ? 1 : 0,
        marginTop: 0,
      }}
      onClick={(e) => e.stopPropagation()}
    >


      <div className="filter-popover-body">
        {/* Sort Section */}
        {onSort && (
          <div className="filter-popover-sort-section">
            {sortFields && sortFields.length > 0 && (
              <>
                <div className="filter-popover-sort-label">Sort by:</div>
                <div className="filter-popover-sort-segmented" role="group" aria-label="Sort by field">
                  {sortFields.map(field => {
                    const isActive = activeSortField === field.key;
                    return (
                      <button
                        key={field.key}
                        type="button"
                        className={`filter-popover-segmented-btn ${isActive ? 'active' : ''}`}
                        onClick={() => onSortFieldChange && onSortFieldChange(field.key)}
                        aria-pressed={isActive}
                      >
                        {field.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <button
              type="button"
              className={`filter-sort-btn ${isSortedAsc ? 'active' : ''}`}
              onClick={() => {
                onSort('asc');
                onClose();
              }}
            >
              <span style={{ fontSize: '0.85rem' }}>↑</span>
              <span>{sortAscLabel || 'Sort Ascending'}</span>
            </button>
            <button
              type="button"
              className={`filter-sort-btn ${isSortedDesc ? 'active' : ''}`}
              onClick={() => {
                onSort('desc');
                onClose();
              }}
            >
              <span style={{ fontSize: '0.85rem' }}>↓</span>
              <span>{sortDescLabel || 'Sort Descending'}</span>
            </button>
          </div>
        )}

        {type === 'text' && (
          <div>
            <input
              type="text"
              placeholder={`Filter ${title.toLowerCase()}...`}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="filter-input"
              autoFocus
            />
            {value && (
              <button
                type="button"
                className="btn-link"
                onClick={() => onChange('')}
                style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'block' }}
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {type === 'daterange' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                From:
              </label>
              <input
                type="date"
                value={value?.from || ''}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
                onClick={(e) => { try { e.target.showPicker?.(); } catch (_) { } }}
                className="filter-input"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                To:
              </label>
              <input
                type="date"
                value={value?.to || ''}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
                onClick={(e) => { try { e.target.showPicker?.(); } catch (_) { } }}
                className="filter-input"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              <button
                type="button"
                className="filter-preset-chip"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  onChange({ ...value, from: today, to: today });
                }}
              >
                Today
              </button>
              <button
                type="button"
                className="filter-preset-chip"
                onClick={() => {
                  const now = new Date();
                  const dayOfWeek = now.getDay();
                  const first = new Date(now);
                  first.setDate(now.getDate() - dayOfWeek);
                  const from = first.toISOString().split('T')[0];
                  const to = new Date().toISOString().split('T')[0];
                  onChange({ ...value, from, to });
                }}
              >
                This Week
              </button>
              <button
                type="button"
                className="filter-preset-chip"
                onClick={() => {
                  const now = new Date();
                  const first = new Date(now.getFullYear(), now.getMonth(), 1);
                  const from = first.toISOString().split('T')[0];
                  const to = new Date().toISOString().split('T')[0];
                  onChange({ ...value, from, to });
                }}
              >
                This Month
              </button>
            </div>

            {/* Multi-select Specific Dates appearing in table */}
            {options.length > 0 && (
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.35rem' }}>
                  Select Specific Dates:
                </label>
                {options.length > 5 && (
                  <div style={{ marginBottom: '0.35rem' }}>
                    <input
                      type="text"
                      placeholder="Search dates..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="filter-input"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      const current = Array.isArray(value?.dates) ? value.dates : [];
                      const visibleValues = visibleOptions.map(o => o.value);
                      const combined = Array.from(new Set([...current, ...visibleValues]));
                      onChange({ ...value, dates: combined });
                    }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      if (!searchTerm.trim()) {
                        onChange({ ...value, dates: [] });
                      } else {
                        const visibleValues = visibleOptions.map(o => o.value);
                        const current = Array.isArray(value?.dates) ? value.dates : [];
                        onChange({ ...value, dates: current.filter(v => !visibleValues.includes(v)) });
                      }
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="filter-multiselect-list" style={{ maxHeight: '130px' }}>
                  {visibleOptions.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.25rem 0' }}>
                      No matching dates
                    </div>
                  ) : (
                    <>
                      {enabledOptions.map((opt) => {
                        const selectedDates = Array.isArray(value?.dates) ? value.dates : [];
                        const checked = selectedDates.includes(opt.value);
                        return (
                          <label key={opt.value} className="filter-multiselect-item">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const current = Array.isArray(value?.dates) ? value.dates : [];
                                const updated = current.includes(opt.value)
                                  ? current.filter(v => v !== opt.value)
                                  : [...current, opt.value];
                                onChange({ ...value, dates: updated });
                              }}
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}

                      {disabledOptions.length > 0 && (
                        <>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)', marginTop: '0.5rem', marginBottom: '0.35rem' }}>
                            Hidden by Active Filter:
                          </label>
                          {disabledOptions.map((opt) => {
                            const selectedDates = Array.isArray(value?.dates) ? value.dates : [];
                            const checked = selectedDates.includes(opt.value);
                            return (
                              <label
                                key={opt.value}
                                className="filter-multiselect-item"
                                style={{ opacity: 0.5, cursor: 'not-allowed' }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={true}
                                />
                                <span>{opt.label}</span>
                              </label>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {(value?.from || value?.to || (value?.dates && value.dates.length > 0)) && (
              <button
                type="button"
                className="btn-link"
                onClick={() => onChange({ from: '', to: '', dates: [] })}
                style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}
              >
                Clear date filter
              </button>
            )}
          </div>
        )}

        {type === 'multiselect' && (
          <div>
            <div style={{ marginBottom: '0.5rem' }}>
              <input
                type="text"
                placeholder="Search values..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="filter-input"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
              <button type="button" className="btn-link" onClick={handleSelectAll}>
                Select All
              </button>
              <button type="button" className="btn-link" onClick={handleClearMultiselect}>
                Clear
              </button>
            </div>
            <div className="filter-multiselect-list">
              {visibleOptions.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
                  No options available
                </div>
              ) : (
                <>
                  {enabledOptions.map((opt) => {
                    const checked = (!value || value.length === 0) ? true : value.includes(opt.value);
                    return (
                      <label key={opt.value} className="filter-multiselect-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleMultiselectToggle(opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}

                  {disabledOptions.length > 0 && (
                    <>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)', marginTop: '0.5rem', marginBottom: '0.35rem' }}>
                        Hidden by Active Filter:
                      </label>
                      {disabledOptions.map((opt) => {
                        const checked = (!value || value.length === 0) ? true : value.includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className="filter-multiselect-item"
                            style={{ opacity: 0.5, cursor: 'not-allowed' }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={true}
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <span ref={anchorRef} style={{ display: 'none' }} />
      {createPortal(popoverContent, document.body)}
    </>
  );
}
