import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Reusable, accessible Tooltip component.
 *
 * Supports:
 * - Click/tap-to-toggle (no hover state)
 * - Outside click & Escape key dismissal
 * - ARIA accessibility (role="tooltip", aria-expanded, aria-label)
 *
 * @param {Object} props
 * @param {React.ReactNode} props.content - Text or JSX to display in the tooltip popover
 * @param {string} [props.ariaLabel="Help information"] - Accessible label for the trigger button
 * @param {string} [props.position="top"] - Preferred placement ('top' | 'bottom' | 'right' | 'left')
 * @param {React.ReactNode} [props.icon] - Optional custom icon (defaults to Lucide HelpCircle)
 * @param {string} [props.className=""] - Optional extra class name for container
 */
export function Tooltip({
  content,
  ariaLabel = 'Help information',
  position = 'top',
  icon = null,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  const toggleTooltip = useCallback((e) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  }, []);

  // Dismiss tooltip on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        if (triggerRef.current) {
          triggerRef.current.focus();
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <span
      ref={containerRef}
      className={`help-tooltip-wrapper ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`help-tooltip-trigger ${isOpen ? 'active' : ''}`}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={toggleTooltip}
      >
        {icon || <HelpCircle size={16} strokeWidth={2} />}
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className={`help-tooltip-popover position-${position}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="help-tooltip-content">
            {content}
          </div>
        </div>
      )}
    </span>
  );
}

export default Tooltip;
