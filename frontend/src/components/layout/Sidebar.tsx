import React from 'react';
import { BrandLogo } from '../common/BrandLogo';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Network,
  Truck,
  Activity,
  CheckCircle2,
  ShieldCheck,
  FileText,
  ExternalLink
} from 'lucide-react';

interface SidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onNavigate,
  isOpenMobile,
  onCloseMobile
}) => {
  // Navigation structure adhering strictly to specified hierarchy
  const operationsNav = [
    { label: 'Overview', route: '/dashboard', icon: LayoutDashboard },
    { label: 'Donations', route: '/donations', icon: UtensilsCrossed },
    { label: 'NGO Matching', route: '/matching', icon: Network },
    { label: 'Pickup Requests', route: '/pickups', icon: Truck },
    { label: 'Official Test Scenarios', route: '/test-scenarios', icon: CheckCircle2 },
    { label: 'Agent Runs and Evidence', route: '/agent-runs', icon: Activity },
  ];

  const governanceNav = [
    { label: 'Privacy and Governance', route: '/privacy', icon: ShieldCheck },
    { label: 'Terms of Service', route: '/terms', icon: FileText },
  ];

  const renderNavGroup = (title: string, items: typeof operationsNav) => (
    <div className="space-y-1">
      <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-secondaryText uppercase">
        {title}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          currentRoute === item.route ||
          (item.route !== '/dashboard' && currentRoute.startsWith(item.route));

        return (
          <button
            key={item.route}
            type="button"
            onClick={() => {
              onNavigate(item.route);
              onCloseMobile();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-[7px] text-xs font-medium transition-colors text-left cursor-pointer ${
              isActive
                ? 'bg-sage text-forest-dark font-semibold border border-forest/15'
                : 'text-primaryText hover:bg-[#F2F5F1] hover:text-forest-dark'
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-forest' : 'text-secondaryText'}`} />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-borderLine select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-borderLine">
        <button
          type="button"
          className="text-left w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest rounded-[6px]"
          onClick={() => {
            onNavigate('/');
            onCloseMobile();
          }}
          aria-label="FoodBridge AI Home"
        >
          <BrandLogo size="md" showTagline />
        </button>
      </div>

      {/* Main Navigation with Consistent 8-pt Rhythm */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {renderNavGroup('Operations', operationsNav)}
        {renderNavGroup('Governance & Policy', governanceNav)}
      </div>

      {/* Visually Quiet Mock Environment Indicator */}
      <div className="p-3.5 border-t border-borderLine bg-[#FAFBF9] space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-secondaryText" aria-hidden="true" />
          <span className="text-[11px] font-semibold text-primaryText uppercase tracking-wider">
            Mock Sandbox
          </span>
          <span className="text-[10px] text-secondaryText px-1.5 py-0.2 rounded bg-borderLine/50 font-mono">
            SQLite
          </span>
        </div>
        <p className="text-[11px] text-secondaryText leading-relaxed">
          Enforces FDA Food Code §3-501.19 limits and simulated human approval state machine.
        </p>
        <button
          type="button"
          onClick={() => {
            onNavigate('/');
            onCloseMobile();
          }}
          className="inline-flex items-center gap-1.5 text-xs text-forest hover:text-forest-dark font-medium cursor-pointer"
        >
          <span>Return to Public Site</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
