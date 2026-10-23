import React from 'react';
import { Navigation } from '../components/layout/Navigation';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '../config';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Thermometer,
  Scale,
  Eye,
  FileText,
  UserCheck,
  Building2
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (route: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen flex flex-col bg-ivory text-primaryText font-sans">
      {/* Navigation Header */}
      <Navigation onNavigate={onNavigate} currentRoute="/" />

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-12 pb-20 sm:pt-16 sm:pb-24 border-b border-borderLine bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Editorial Copy */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[5px] bg-sage text-forest-dark border border-forest/15 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-forest" />
                  <span>Evidence-Backed Food Rescue Protocol</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-heading text-primaryText tracking-tight leading-[1.12]">
                  Good food deserves a destination.
                </h1>

                <p className="text-lg sm:text-xl text-secondaryText leading-relaxed max-w-2xl font-normal">
                  Connect commercial kitchens with verified community organizations ready to receive surplus food safely and on time. {PRODUCT_NAME} coordinates food safety checks, candidate ranking, human approval sign-off, and verified platform execution in one auditable workflow.
                </p>

                {/* Primary & Secondary Actions */}
                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => onNavigate('/dashboard')}
                    icon={<ArrowRight className="w-5 h-5" />}
                  >
                    Open the Demo
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    See How It Works
                  </Button>

                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => onNavigate('/test-scenarios')}
                    icon={<CheckCircle2 className="w-4 h-4 text-forest" />}
                  >
                    Official Test Scenarios
                  </Button>
                </div>

                {/* Trust Rules */}
                <div className="pt-6 border-t border-borderLine grid grid-cols-3 gap-4 text-xs text-secondaryText">
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-forest flex-shrink-0" />
                    <span>FDA §3-501.19 Rules</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-forest flex-shrink-0" />
                    <span>Strict Human Gating</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-forest flex-shrink-0" />
                    <span>Verifiable Evidence Log</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Authentic Editorial Photo */}
              <div className="lg:col-span-5 relative">
                <div className="relative rounded-[10px] overflow-hidden border border-borderLine shadow-sm bg-[#ECEEE9]">
                  <img
                    src="/images/hero.jpg"
                    alt="Commercial kitchen chef packing surplus meals into food-safe takeaway containers"
                    className="w-full h-auto object-cover aspect-[4/3] block"
                    loading="eager"
                  />
                  <div className="p-3.5 bg-white border-t border-borderLine flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-forest" aria-hidden="true" />
                      <span className="font-semibold text-primaryText">Kitchen Staging Protocol</span>
                    </div>
                    <span className="text-secondaryText font-mono">Thermal Holding Monitored</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs uppercase tracking-widest font-bold text-forest">
              Standard Operating Workflow
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold font-heading text-primaryText">
              How Food Rescue Coordination Works
            </h3>
            <p className="text-secondaryText text-base leading-relaxed">
              Every donation moves through an auditable four-stage process designed to enforce food safety and ensure full operational accountability.
            </p>
          </div>

          {/* 4 Steps Process */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Step 1 */}
            <Card padding="md" className="flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-[6px] bg-forest text-white flex items-center justify-center font-heading font-bold text-sm mb-4">
                  1
                </div>
                <h4 className="font-heading font-bold text-lg text-primaryText mb-2">
                  List surplus food
                </h4>
                <p className="text-sm text-secondaryText leading-relaxed">
                  Restaurants record prepared food quantity, storage temperature, preparation timestamp, and requested dispatch window.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-borderLine text-xs font-mono text-secondaryText flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-forest" />
                <span>Cold/Hot Chain Record</span>
              </div>
            </Card>

            {/* Step 2 */}
            <Card padding="md" className="flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-[6px] bg-forest text-white flex items-center justify-center font-heading font-bold text-sm mb-4">
                  2
                </div>
                <h4 className="font-heading font-bold text-lg text-primaryText mb-2">
                  Match an eligible NGO
                </h4>
                <p className="text-sm text-secondaryText leading-relaxed">
                  The agent validates hard constraints: food holding limits, active NGO intake capacity, dietary compatibility, and service radius.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-borderLine text-xs font-mono text-secondaryText flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-forest" />
                <span>Multi-Factor Ranking</span>
              </div>
            </Card>

            {/* Step 3 */}
            <Card padding="md" className="flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-[6px] bg-forest text-white flex items-center justify-center font-heading font-bold text-sm mb-4">
                  3
                </div>
                <h4 className="font-heading font-bold text-lg text-primaryText mb-2">
                  Review and approve pickup
                </h4>
                <p className="text-sm text-secondaryText leading-relaxed">
                  No action executes automatically. The restaurant manager must review the proposed NGO, destination drop-off location, and timing.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-borderLine text-xs font-mono text-secondaryText flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-forest" />
                <span>Human Operator Gating</span>
              </div>
            </Card>

            {/* Step 4 */}
            <Card padding="md" className="flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-[6px] bg-forest text-white flex items-center justify-center font-heading font-bold text-sm mb-4">
                  4
                </div>
                <h4 className="font-heading font-bold text-lg text-primaryText mb-2">
                  Verify request status
                </h4>
                <p className="text-sm text-secondaryText leading-relaxed">
                  The platform executes the dispatch, independently queries resulting database status, and guards against premature collection claims.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-borderLine text-xs font-mono text-secondaryText flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-forest" />
                <span>Status Verification</span>
              </div>
            </Card>
          </div>
        </section>

        {/* Safety and Trust Section */}
        <section id="safety" className="py-20 bg-white border-y border-borderLine">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Safety Explanation */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[5px] bg-[#EBF5EE] text-brandSuccess border border-[#C7E3D0] text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-brandSuccess" />
                  <span>Operational Governance</span>
                </div>

                <h3 className="text-3xl sm:text-4xl font-extrabold font-heading text-primaryText">
                  Prioritizing food safety, reliability, and human control.
                </h3>

                <p className="text-secondaryText text-base leading-relaxed">
                  Food rescue logistics requires rigorous risk management. {PRODUCT_NAME} enforces deterministic safety policies that prevent expired food donations from ever being scheduled or dispatched.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="flex items-start gap-3.5">
                    <div className="w-6 h-6 rounded-full bg-sage flex items-center justify-center text-forest-dark flex-shrink-0 mt-0.5">
                      <Thermometer className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-primaryText">Time-as-a-Public-Health-Control (FDA §3-501.19)</h5>
                      <p className="text-xs text-secondaryText leading-relaxed">
                        Deterministic 240-minute limit for ambient/hot prepared meals and 24-hour limit for refrigerated items.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-6 h-6 rounded-full bg-sage flex items-center justify-center text-forest-dark flex-shrink-0 mt-0.5">
                      <Scale className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-primaryText">NGO Intake Capacity Verification</h5>
                      <p className="text-xs text-secondaryText leading-relaxed">
                        Checks active live intake capacity so partner shelters are never overloaded or sent unmanageable quantities.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-6 h-6 rounded-full bg-sage flex items-center justify-center text-forest-dark flex-shrink-0 mt-0.5">
                      <UserCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-primaryText">Human Operator Approval Gating</h5>
                      <p className="text-xs text-secondaryText leading-relaxed">
                        Consequential actions are blocked until confirmed by human operators. If an NGO alters the drop-off location, the approval is immediately invalidated.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-6 h-6 rounded-full bg-sage flex items-center justify-center text-forest-dark flex-shrink-0 mt-0.5">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-primaryText">Traceable Decision Evidence</h5>
                      <p className="text-xs text-secondaryText leading-relaxed">
                        Every match, rejection, and state change produces an immutable audit record with timestamps, raw database queries, and constraint logs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Operations Photography */}
              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
                <div className="rounded-[10px] overflow-hidden border border-borderLine shadow-xs bg-[#F2F5F1]">
                  <img
                    src="/images/restaurant-ops.jpg"
                    alt="Kitchen staging counter with temperature monitored packaged meals"
                    className="w-full h-auto object-cover aspect-[16/10] block"
                  />
                  <div className="p-3 bg-white border-t border-borderLine">
                    <span className="text-xs font-semibold text-primaryText block">Commercial Staging Protocol</span>
                    <span className="text-[11px] text-secondaryText">Certified tamper-evident packaging and thermal control</span>
                  </div>
                </div>

                <div className="rounded-[10px] overflow-hidden border border-borderLine shadow-xs bg-[#F2F5F1]">
                  <img
                    src="/images/ngo-collection.jpg"
                    alt="Volunteers receiving neat boxes at community hub"
                    className="w-full h-auto object-cover aspect-[16/10] block"
                  />
                  <div className="p-3 bg-white border-t border-borderLine">
                    <span className="text-xs font-semibold text-primaryText block">Community Distribution Intake</span>
                    <span className="text-[11px] text-secondaryText">Intake capacity verified prior to vehicle dispatch</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Gallery Section */}
        <section className="py-16 bg-[#F4F6F2] border-t border-borderLine">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="rounded-[10px] overflow-hidden border border-borderLine bg-white shadow-xs">
                <img
                  src="/images/food-donation.jpg"
                  alt="Freshly prepared wholesome meals packed in takeaway meal boxes"
                  className="w-full h-auto object-cover aspect-[16/9] block"
                />
                <div className="p-4">
                  <h5 className="font-heading font-bold text-sm text-primaryText">Prepared Surplus Packaging</h5>
                  <p className="text-xs text-secondaryText mt-1">Wholesome restaurant meals packed into tamper-evident, food-safe containers.</p>
                </div>
              </div>

              <div className="rounded-[10px] overflow-hidden border border-borderLine bg-white shadow-xs">
                <img
                  src="/images/community-impact.jpg"
                  alt="Community volunteers organizing fresh meal boxes in community center"
                  className="w-full h-auto object-cover aspect-[16/9] block"
                />
                <div className="p-4">
                  <h5 className="font-heading font-bold text-sm text-primaryText">Community Meal Distribution</h5>
                  <p className="text-xs text-secondaryText mt-1">Rescued meals received by verified local distribution networks and neighborhood shelters.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-borderLine py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 space-y-3">
              <h4 className="font-heading font-bold text-lg text-primaryText">{PRODUCT_NAME}</h4>
              <p className="text-xs text-secondaryText leading-relaxed max-w-sm">
                AI-Powered surplus food donation and rescue coordination platform. Demonstration with mock API backend and persistent SQLite audit records.
              </p>
              <div className="pt-1 text-[11px] text-secondaryText">
                Mock Donation Platform Target — Autonomous LangGraph Agent Operations with SQLite Ledger.
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-primaryText mb-3">Operations</h5>
              <ul className="space-y-2 text-xs text-secondaryText">
                <li><button type="button" onClick={() => onNavigate('/dashboard')} className="hover:text-primaryText cursor-pointer">Operations overview</button></li>
                <li><button type="button" onClick={() => onNavigate('/donations')} className="hover:text-primaryText cursor-pointer">Donations</button></li>
                <li><button type="button" onClick={() => onNavigate('/matching')} className="hover:text-primaryText cursor-pointer">NGO Matching</button></li>
                <li><button type="button" onClick={() => onNavigate('/pickups')} className="hover:text-primaryText cursor-pointer">Pickup Requests</button></li>
                <li><button type="button" onClick={() => onNavigate('/test-scenarios')} className="hover:text-primaryText cursor-pointer">Official Test Scenarios</button></li>
                <li><button type="button" onClick={() => onNavigate('/agent-runs')} className="hover:text-primaryText cursor-pointer">Agent Runs and Evidence</button></li>
              </ul>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-primaryText mb-3">Governance</h5>
              <ul className="space-y-2 text-xs text-secondaryText">
                <li><button type="button" onClick={() => onNavigate('/privacy')} className="hover:text-primaryText cursor-pointer">Privacy and Governance</button></li>
                <li><button type="button" onClick={() => onNavigate('/terms')} className="hover:text-primaryText cursor-pointer">Terms of Service</button></li>
                <li><span className="text-secondaryText/70">FDA Food Code §3-501.19</span></li>
                <li><span className="text-secondaryText/70">Codex Alimentarius CAC/RCP 39-1993</span></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-borderLine flex flex-col sm:flex-row items-center justify-between text-xs text-secondaryText gap-4">
            <div>
              © 2026 {PRODUCT_NAME}. Food Rescue Logistics Platform.
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-secondaryText" aria-hidden="true" />
              <span>Sandbox Environment Active</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
