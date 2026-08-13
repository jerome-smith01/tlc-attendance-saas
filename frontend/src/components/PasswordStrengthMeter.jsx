import React from 'react';

/**
 * Returns true if password satisfies all required minimum password rules:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 number or special character
 */
export function passwordMeetsMinimum(password) {
  if (!password || typeof password !== 'string') return false;
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumOrSpecial = /[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password);

  return hasMinLength && hasUppercase && hasNumOrSpecial;
}

/**
 * Evaluates password strength and rule compliance.
 */
export function getPasswordStrength(password = '') {
  const pwd = password || '';
  const rules = [
    { key: 'minLength', label: 'At least 8 characters', met: pwd.length >= 8 },
    { key: 'uppercase', label: 'At least 1 uppercase letter', met: /[A-Z]/.test(pwd) },
    { key: 'numOrSpecial', label: 'At least 1 number or special character', met: /[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd) },
  ];

  const metCount = rules.filter((r) => r.met).length;
  const hasExtraLength = pwd.length >= 12;
  const hasBothNumAndSpecial = /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd);

  let label = 'Weak';
  let color = 'var(--color-error, #ef4444)';
  let percentage = 25;

  if (!pwd) {
    label = 'Weak';
    percentage = 0;
    color = 'var(--muted-foreground, #94a3b8)';
  } else if (metCount === 3) {
    if (hasExtraLength || hasBothNumAndSpecial) {
      label = 'Very Strong';
      color = '#10b981';
      percentage = 100;
    } else {
      label = 'Strong';
      color = 'var(--color-success, #22c55e)';
      percentage = 75;
    }
  } else if (metCount === 2) {
    label = 'Fair';
    color = 'var(--color-warning, #f59e0b)';
    percentage = 50;
  } else {
    label = 'Weak';
    color = 'var(--color-error, #ef4444)';
    percentage = 25;
  }

  return { rules, metCount, label, color, percentage };
}

/**
 * Reusable PasswordStrengthMeter component.
 */
export function PasswordStrengthMeter({ password = '' }) {
  const { rules, label, color, percentage } = getPasswordStrength(password);

  return (
    <div className="password-strength-meter" style={{ marginTop: '8px', fontSize: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ color: 'var(--muted-foreground, #64748b)', fontSize: '0.8rem', fontWeight: 500 }}>
          Password Strength
        </span>
        {password ? (
          <span style={{ color: color, fontWeight: 600, fontSize: '0.8rem' }}>
            {label}
          </span>
        ) : null}
      </div>

      <div
        style={{
          width: '100%',
          height: '6px',
          backgroundColor: 'var(--muted, #e4e4e7)',
          borderRadius: 'var(--radius-pill, 9999px)',
          overflow: 'hidden',
          marginBottom: '8px',
          transition: 'all 0.3s ease',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: 'var(--radius-pill, 9999px)',
            transition: 'width 0.3s ease, background-color 0.3s ease',
          }}
        />
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {rules.map((rule) => (
          <li
            key={rule.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: rule.met ? 'var(--color-success, #22c55e)' : 'var(--muted-foreground, #64748b)',
              fontSize: '0.8rem',
              transition: 'color 0.2s ease',
            }}
          >
            <span style={{ fontWeight: 'bold', width: '14px', display: 'inline-block', textAlign: 'center' }}>
              {rule.met ? '✓' : '✗'}
            </span>
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PasswordStrengthMeter;
