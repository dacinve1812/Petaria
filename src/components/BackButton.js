import React from 'react';
import './BackButton.css';

const BackButton = ({ onClick, className = '' }) => {
  return (
    <div className={`back-button-container ${className}`}>
      <button className="back-button" onClick={onClick}>
        <svg 
          width="48" 
          height="48" 
          viewBox="0 0 48 48" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="back-button-svg"
        >
          {/* Circle outline */}
          <circle 
            cx="24" 
            cy="24" 
            r="22" 
            fill="none" 
            stroke="var(--back-button-outline, #ff4444)" 
            strokeWidth="4"
          />
          {/* Arrow pointing left */}
          <path 
            d="M30 16 L15 24 L30 32" 
            stroke="var(--back-button-icon, #ff4444)" 
            strokeWidth="4" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>
    </div>
  );
};

export default BackButton; 