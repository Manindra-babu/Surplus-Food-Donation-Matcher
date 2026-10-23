import React from 'react';
import { PRODUCT_NAME } from '../../config';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = false
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base font-semibold',
    lg: 'text-xl font-bold'
  };

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      {/* Crisp Geometric Food Bridge Mark */}
      <div className={`${iconSizes[size]} flex-shrink-0 bg-forest rounded-[7px] p-1.5 flex items-center justify-center border border-forest-dark/30 shadow-xs`}>
        <svg viewBox="0 0 48 48" fill="none" className="w-full h-full" aria-hidden="true">
          <path d="M12 23C12 21.8954 12.8954 21 14 21H34C35.1046 21 36 21.8954 36 23V30C36 33.3137 33.3137 36 30 36H18C14.6863 36 12 33.3137 12 30V23Z" fill="#FAF8F2"/>
          <path d="M18 21V18C18 14.6863 20.6863 12 24 12C27.3137 12 30 14.6863 30 18V21" stroke="#FAF8F2" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="24" cy="28.5" r="3.5" fill="#D97745"/>
        </svg>
      </div>

      <div className="flex flex-col min-w-0 leading-tight">
        <span className={`font-heading tracking-tight text-primaryText whitespace-nowrap truncate ${textSizes[size]}`}>
          {PRODUCT_NAME}
        </span>
        {showTagline && (
          <span className="text-[11px] text-secondaryText font-normal whitespace-nowrap truncate">
            Food Rescue Operations
          </span>
        )}
      </div>
    </div>
  );
};
