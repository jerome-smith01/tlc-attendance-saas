import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Reusable, accessible Tooltip component.
 *
 * Supports:
 * - Click / tap to toggle open & close
 * - Smart auto-adjustment to prevent overflowing viewport edges on mobile/narrow screens
 * - Outside click & Escape key dismissal
 * - ARIA accessibility (role="tooltip", aria-expanded, aria-label)
 *
 * @param {Object} props
 * @param {React.ReactNode} props.content - Text or JSX to display in the tooltip popover
 * @param {string} [props.ariaLabel="Help information"] - Accessible label for the trigger button
 * @param {string} [props.position="right"] - Preferred placement ('top' | 'bottom' | 'right' | 'left')
 * @param {React.ReactNode} [props.icon] - Optional custom icon (defaults to Lucide HelpCircle)
 * @param {string} [props.className=""] - Optional extra class name for container
 */
export function Tooltip({
  content,
  ariaLabel = 'Help information',
  position = 'right',
  icon = null,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [shiftOffset, setShiftOffset] = useState(0);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const toggleTooltip = useCallback((e) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  }, []);

  const adjustPosition = useCallback(() => {
    if (!popoverRef.current) return;
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const margin = 12;
    let offset = 0;

    if (popoverRect.right > window.innerWidth - margin) {
      offset = (window.innerWidth - margin) - popoverRect.right;
    } else if (popoverRect.left < margin) {
      offset = margin - popoverRect.left;
    }

    setShiftOffset(prev => (prev !== offset ? offset : prev));
  }, []);

  useLayoutEffect(() => {
    if (isOpen) {
      adjustPosition();
    } else {
      setShiftOffset(0);
    }
  }, [isOpen, adjustPosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => adjustPosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

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
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, adjustPosition]);

  const getPopoverStyle = () => {
    if (!shiftOffset) return undefined;
    if (position === 'right' || position === 'left') {
      return { transform: `translateY(-50%) translateX(${shiftOffset}px)` };
    }
    return { transform: `translateX(calc(-50% + ${shiftOffset}px))` };
  };

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
          ref={popoverRef}
          role="tooltip"
          className={`help-tooltip-popover position-${position}`}
          style={getPopoverStyle()}
        >
          <div className="help-tooltip-content">
            {content}
          </div>
        </div>
      )}
    </span>
  );
}

/**
 * Standardized privacy explanation tooltip specifically for Last Initial fields across the app.
 */
export function LastInitialTooltip({ className = '', position = 'right' }) {
  return (
    <Tooltip
      ariaLabel="Why only last initial?"
      position={position}
      className={className}
      content={
        <span>
          To protect youth privacy and comply with the{' '}
          <a
            href="https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions"
            target="_blank"
            rel="noopener noreferrer"
          >
            Children's Online Privacy Protection Act (COPPA)
          </a>
          , we only collect first names and last initials.
        </span>
      }
    />
  );
}

export default Tooltip;

