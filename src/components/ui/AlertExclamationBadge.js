import React from 'react';
import './AlertExclamationBadge.css';

/**
 * Badge vuông bo góc, nền đỏ + dấu chấm than trắng (thông báo / thư mới).
 */
export function AlertExclamationBadge({
  size = 20,
  className = '',
  title = 'Có thông báo mới',
  ariaLabel,
  ...rest
}) {
  const label = ariaLabel ?? title;
  return (
    <span
      className={`alert-exclamation-badge ${className}`.trim()}
      title={title}
      role="img"
      aria-label={label}
      {...rest}
    >
      <svg
        className="alert-exclamation-badge__svg"
        viewBox="0 0 20 20"
        width={size}
        height={size}
        aria-hidden
        focusable="false"
      >
        <rect
          x="1.5"
          y="1.5"
          width="17"
          height="17"
          rx="5"
          fill="#e53935"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="1"
        />
        <path fill="#fff" d="M9 5h2v6H9V5zm0 7h2v2H9v-2z" />
      </svg>
    </span>
  );
}
