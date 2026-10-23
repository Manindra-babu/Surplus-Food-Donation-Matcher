import React from 'react';
import { StatusVariant } from '../../utils/status';

interface BadgeProps {
  children: React.ReactNode;
  variant?: StatusVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
  title
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5'
  };

  const variantStyles: Record<StatusVariant, string> = {
    neutral: 'bg-[#F2F4F1] text-primaryText border-borderLine',
    forest: 'bg-sage text-forest-dark border-forest/20 font-medium',
    success: 'bg-[#EBF5EE] text-brandSuccess border-[#C7E3D0] font-medium',
    warning: 'bg-[#FDF3E7] text-brandWarning border-[#F2D7B3] font-medium',
    danger: 'bg-[#FBEBEA] text-brandError border-[#F2C2BF] font-medium',
    info: 'bg-[#EEF4F8] text-[#1E5275] border-[#CADEEA] font-medium'
  };

  return (
    <span
      className={`inline-flex items-center rounded-[5px] border font-medium select-none whitespace-nowrap ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      title={title}
    >
      {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
