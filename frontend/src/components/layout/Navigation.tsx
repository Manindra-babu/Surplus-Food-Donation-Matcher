import React, { useState } from 'react';
import { BrandLogo } from '../common/BrandLogo';
import { Button } from '../common/Button';
import { ArrowRight, Menu, X, CheckCircle2 } from 'lucide-react';

interface NavigationProps {
  onNavigate: (route: string) => void;
  currentRoute: string;
}

export const Navigation: React.FC<NavigationProps> = ({ onNavigate, currentRoute }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'How It Works', route: 'how-it-works' },
    { label: 'Safety & Trust', route: 'safety' },
    { label: 'Official Test Scenarios', route: 'scenarios' },
    { label: 'Documentation', route: 'privacy' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-borderLine">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest rounded-[6px]"
          aria-label="FoodBridge AI Home"
        >
          <BrandLogo size="md" />
        </button>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center space-x-7 text-sm font-medium text-secondaryText">
          {navItems.map((item) => (
            <button
              key={item.route}
              type="button"
              onClick={() => {
                if (item.route === 'privacy') {
                  onNavigate('/privacy');
                } else if (item.route === 'scenarios') {
                  onNavigate('/test-scenarios');
                } else {
                  if (currentRoute !== '/') {
                    onNavigate('/');
                    setTimeout(() => {
                      document.getElementById(item.route)?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  } else {
                    document.getElementById(item.route)?.scrollIntoView({ behavior: 'smooth' });
                  }
                }
              }}
              className="hover:text-primaryText transition-colors py-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest rounded-[4px]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Action Button */}
        <div className="hidden sm:flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/test-scenarios')}
            icon={<CheckCircle2 className="w-4 h-4 text-forest" />}
          >
            Run Test Suite
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('/dashboard')}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Open Demo
          </Button>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-[6px] text-secondaryText hover:text-primaryText hover:bg-sage/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-borderLine bg-white px-4 pt-3 pb-5 space-y-3">
          {navItems.map((item) => (
            <button
              key={item.route}
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                if (item.route === 'privacy') {
                  onNavigate('/privacy');
                } else if (item.route === 'scenarios') {
                  onNavigate('/test-scenarios');
                } else {
                  if (currentRoute !== '/') {
                    onNavigate('/');
                    setTimeout(() => {
                      document.getElementById(item.route)?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  } else {
                    document.getElementById(item.route)?.scrollIntoView({ behavior: 'smooth' });
                  }
                }
              }}
              className="block w-full text-left py-2 text-sm font-medium text-primaryText hover:bg-sage/30 px-2 rounded-[5px] cursor-pointer"
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 border-t border-borderLine space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('/test-scenarios');
              }}
            >
              Run Test Suite
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="w-full justify-center"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('/dashboard');
              }}
            >
              Open Demo
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
