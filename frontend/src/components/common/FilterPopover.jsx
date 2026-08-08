import React, { useState, useEffect, useRef, useMemo } from 'react';

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
  sortDescLabel
}) {
  const popoverRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Reset local search term when popover opens/closes
  useEffect(() => {
    if (!isOpen) setSearchTerm('');
  }, [isOpen]);

  const visibleOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const lower = searchTerm.toLowerCase();
    return options.filter(opt => opt.label.toLowerCase().includes(lower));
  }, [options, searchTerm]);

  if (!isOpen) return null;

  const isSortedAsc = sortConfig?.key === columnKey && sortConfig?.direction === 'asc';
  const isSortedDesc = sortConfig?.key === columnKey && sortConfig?.direction === 'desc';

  const handleMultiselectToggle = (optVal) => {
    const current = Array.isArray(value) ? value : [];
    if (current.includes(optVal)) {
      onChange(current.filter(v => v !== optVal));
    } else {
      onChange([...current, optVal]);
    }
  };

  const handleSelectAll = () => {
    const current = Array.isArray(value) ? value : [];
    const visibleValues = visibleOptions.map(o => o.value);
    const combined = Array.from(new Set([...current, ...visibleValues]));
    onChange(combined);
  };

  const handleClearMultiselect = () => {
    if (!searchTerm.trim()) {
      onChange([]);
    } else {
      const visibleValues = visibleOptions.map(o => o.value);
      const current = Array.isArray(value) ? value : [];
      onChange(current.filter(v => !visibleValues.includes(v)));
    }
  };

  return (
    <div
      ref={popoverRef}
      className="filter-popover glass-card"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="filter-popover-header">
        <span>Filter {title}</span>
        <button
          type="button"
          className="filter-popover-close"
          onClick={onClose}
          aria-label="Close filter"
        >
          &times;
        </button>
      </div>

      <div className="filter-popover-body">
        {/* Sort Section */}
        {onSort && (
          <div className="filter-popover-sort-section">
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
                className="filter-input"
              />
            </div>
            {(value?.from || value?.to) && (
              <button
                type="button"
                className="btn-link"
                onClick={() => onChange({ from: '', to: '' })}
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
                visibleOptions.map((opt) => {
                  const checked = (Array.isArray(value) ? value : []).includes(opt.value);
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
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
