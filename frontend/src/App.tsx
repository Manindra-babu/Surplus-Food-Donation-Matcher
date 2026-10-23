import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Navigation } from './components/layout/Navigation';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { DonationsPage } from './pages/DonationsPage';
import { DonationNewPage } from './pages/DonationNewPage';
import { MatchingPage } from './pages/MatchingPage';
import { PickupsPage } from './pages/PickupsPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { AgentRunsPage } from './pages/AgentRunsPage';
import { AgentRunDetailPage } from './pages/AgentRunDetailPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { api } from './services/api';
import { CheckCircle2 } from 'lucide-react';

export function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return (window.location.pathname + window.location.search) || '/';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [resetToast, setResetToast] = useState<string | null>(null);

  // Normalize route aliases and strip query parameters for page matching
  const normalizeRoute = (raw: string): string => {
    const pathname = (raw.split('?')[0] || '/').replace(/\/+$/, '') || '/';
    if (pathname === '/scenarios' || pathname === '/test-scenario') return '/test-scenarios';
    if (pathname === '/runs') return '/agent-runs';
    if (pathname === '/overview') return '/dashboard';
    if (pathname === '/donation/new' || pathname === '/new-donation') return '/donations/new';
    if (pathname === '/pickup' || pathname === '/pickup-requests') return '/pickups';
    if (pathname === '/match') return '/matching';
    return pathname;
  };

  const normalizedRoute = normalizeRoute(currentRoute);

  // Sync route with browser history
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute((window.location.pathname + window.location.search) || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (route: string) => {
    window.history.pushState({}, '', route);
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetDemo = async () => {
    if (!window.confirm("Reset sandbox database to initial clean seed records?")) return;
    setResettingDemo(true);
    try {
      const res = await api.resetDemo();
      setResetToast(res.message || "Database successfully reset with fresh seed records.");
      setTimeout(() => setResetToast(null), 4000);
      navigate(currentRoute);
    } catch (err: any) {
      alert("Failed to reset demo database: " + err.message);
    } finally {
      setResettingDemo(false);
    }
  };

  // Route matching
  const isPublicRoute = normalizedRoute === '/' || normalizedRoute === '/privacy' || normalizedRoute === '/terms';

  // Extract runId for /agent-runs/:id
  const runDetailMatch = normalizedRoute.match(/^\/agent-runs\/([^\/]+)$/);
  const activeRunId = runDetailMatch ? runDetailMatch[1] : null;

  // Page title mapping for top bar matching standard terminology
  const getPageTitle = (route: string) => {
    if (route === '/dashboard') return { title: 'Operations overview', subtitle: 'Simulated rescue operations computed from real-time database records' };
    if (route === '/donations') return { title: 'Donations', subtitle: 'Active prepared surplus batches and food-safety status' };
    if (route === '/donations/new') return { title: 'New Donation', subtitle: 'Food-safety time control verification (FDA Food Code §3-501.19)' };
    if (route === '/matching') return { title: 'NGO Matching', subtitle: 'Multi-stage candidate evaluation and human sign-off' };
    if (route === '/pickups') return { title: 'Pickup Requests', subtitle: 'Dispatch state machine, location invalidation gating, and status verification' };
    if (route === '/test-scenarios') return { title: 'Official Test Scenarios', subtitle: 'Executable verification suite (TC1 – TC4)' };
    if (route.startsWith('/agent-runs')) return { title: 'Agent Runs and Evidence', subtitle: 'Immutable 10-stage trace logs and snapshot ledger' };
    return { title: 'FoodBridge AI', subtitle: 'Food Rescue Operations Platform' };
  };

  const pageMeta = getPageTitle(normalizedRoute);

  return (
    <div className="min-h-screen bg-ivory text-primaryText flex flex-col font-sans">
      {/* Reset Toast Notification */}
      {resetToast && (
        <div className="fixed top-4 right-4 z-50 p-3.5 rounded-[8px] bg-forest text-white text-xs shadow-md flex items-center gap-2 border border-forest-dark animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          <span>{resetToast}</span>
        </div>
      )}

      {/* Render Public Landing / Policy Pages */}
      {normalizedRoute === '/' && <LandingPage onNavigate={navigate} />}

      {normalizedRoute === '/privacy' && (
        <div className="min-h-screen flex flex-col bg-ivory">
          <Navigation onNavigate={navigate} currentRoute={normalizedRoute} />
          <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
            <PrivacyPage onNavigate={navigate} />
          </div>
        </div>
      )}

      {normalizedRoute === '/terms' && (
        <div className="min-h-screen flex flex-col bg-ivory">
          <Navigation onNavigate={navigate} currentRoute={normalizedRoute} />
          <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
            <TermsPage onNavigate={navigate} />
          </div>
        </div>
      )}

      {/* Render Operational Dashboard Shell */}
      {!isPublicRoute && (
        <div className="flex-1 flex min-h-screen">
          {/* Sidebar */}
          <Sidebar
            currentRoute={normalizedRoute}
            onNavigate={navigate}
            isOpenMobile={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
          />

          {/* Main Operational Container */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#FAF8F2]">
            <TopBar
              title={pageMeta.title}
              subtitle={pageMeta.subtitle}
              onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
              onRefresh={() => navigate(currentRoute)}
              onResetDemo={handleResetDemo}
              isLoading={resettingDemo}
            />

            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
              {normalizedRoute === '/dashboard' && <DashboardPage onNavigate={navigate} />}
              {normalizedRoute === '/donations' && <DonationsPage onNavigate={navigate} />}
              {normalizedRoute === '/donations/new' && <DonationNewPage onNavigate={navigate} />}
              {normalizedRoute === '/matching' && <MatchingPage onNavigate={navigate} />}
              {normalizedRoute === '/pickups' && <PickupsPage onNavigate={navigate} />}
              {normalizedRoute === '/test-scenarios' && <ScenariosPage onNavigate={navigate} />}
              {normalizedRoute === '/agent-runs' && <AgentRunsPage onNavigate={navigate} />}
              {activeRunId && <AgentRunDetailPage runId={activeRunId} onNavigate={navigate} />}
              {normalizedRoute === '/not-found' && <NotFoundPage onNavigate={navigate} />}
              {!['/dashboard', '/donations', '/donations/new', '/matching', '/pickups', '/test-scenarios', '/agent-runs'].includes(normalizedRoute) && !activeRunId && (
                <NotFoundPage onNavigate={navigate} />
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
