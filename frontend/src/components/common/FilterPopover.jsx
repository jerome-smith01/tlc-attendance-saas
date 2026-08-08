import React, { useEffect, useRef } from 'react';

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
 */
export function FilterPopover({
  isOpen,
  onClose,
  title,
  type,
  value,
  onChange,
  options = []
}) {
  const popoverRef = useRef(null);

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

  if (!isOpen) return null;

  const handleMultiselectToggle = (optVal) => {
    const current = Array.isArray(value) ? value : [];
    if (current.includes(optVal)) {
      onChange(current.filter(v => v !== optVal));
    } else {
      onChange([...current, optVal]);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map(o => o.value));
  };

  const handleClearMultiselect = () => {
    onChange([]);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
              <button type="button" className="btn-link" onClick={handleSelectAll}>
                Select All
              </button>
              <button type="button" className="btn-link" onClick={handleClearMultiselect}>
                Clear
              </button>
            </div>
            <div className="filter-multiselect-list">
              {options.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
                  No options available
                </div>
              ) : (
                options.map((opt) => {
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
