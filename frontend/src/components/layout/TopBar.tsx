import React from 'react';
import { Menu, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '../common/Button';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  onResetDemo?: () => void;
  onOpenMobileMenu?: () => void;
  isLoading?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  subtitle,
  onRefresh,
  onResetDemo,
  onOpenMobileMenu,
  isLoading = false
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-borderLine px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
      {/* Title & Mobile Menu Button */}
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-1.5 rounded-[6px] text-secondaryText hover:text-primaryText hover:bg-sage/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold font-heading text-primaryText tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-secondaryText hidden sm:block truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Badges & Actions */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Quiet Mock Environment Indicator (No Pulse) */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[#F7F9F6] border border-borderLine text-xs text-secondaryText">
          <span className="w-1.5 h-1.5 rounded-full bg-secondaryText" aria-hidden="true" />
          <span className="font-medium text-primaryText text-[11px]">Sandbox Mode</span>
          <span className="text-[10px] text-secondaryText font-mono">(SQLite)</span>
        </div>

        {/* Reset Demo Data Button */}
        {onResetDemo && (
          <Button
            variant="outline"
            size="sm"
            onClick={onResetDemo}
            isLoading={isLoading}
            icon={<RotateCcw className="w-3.5 h-3.5 text-secondaryText" />}
            title="Reset sandbox database to initial clean seed records"
          >
            <span className="hidden md:inline">Reset Sandbox</span>
          </Button>
        )}

        {/* Refresh Action */}
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            isLoading={isLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 text-secondaryText ${isLoading ? 'animate-spin' : ''}`} />}
            aria-label="Refresh view"
            title="Refresh current view"
          />
        )}
      </div>
    </header>
  );
};
