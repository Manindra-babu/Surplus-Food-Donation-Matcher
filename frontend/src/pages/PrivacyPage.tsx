import React from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ArrowLeft, ShieldCheck, Lock, Database, Bot } from 'lucide-react';
import { PRODUCT_NAME, ORGANIZATION_NAME } from '../config';

interface PrivacyPageProps {
  onNavigate: (route: string) => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-borderLine">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate('/')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Return Home
        </Button>
        <span className="text-xs text-secondaryText">Last Updated: October 2026</span>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[5px] bg-sage text-forest-dark border border-forest/15 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Transparency & Data Disclosure</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-primaryText tracking-tight">
          Privacy Policy & Data Practices
        </h2>
        <p className="text-xs text-secondaryText">
          Operational disclosure for the {PRODUCT_NAME} demonstration platform.
        </p>
      </div>

      {/* Demonstration Notice */}
      <div className="p-4 rounded-[8px] bg-ivory border border-borderLine text-xs text-secondaryText leading-relaxed space-y-2">
        <strong className="text-primaryText block font-heading">Hackathon Demonstration Notice</strong>
        <p>
          This application is an autonomous AI agent application developed for the official hackathon challenge, executing against the Mock Donation Platform target specified in the catalogue. The deployment operates with demonstration records for restaurants and NGOs, running on a local SQLite database. No real personal banking details, government IDs, or sensitive consumer personal data are collected.
        </p>
      </div>

      <Card padding="md" className="space-y-5 text-xs text-secondaryText leading-relaxed">
        <section className="space-y-2">
          <h3 className="font-heading font-bold text-sm text-primaryText">1. Data Collected by the Platform</h3>
          <p>
            When utilizing the {PRODUCT_NAME} platform, the system collects and persists:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Restaurant Profiles:</strong> Business name, address, cuisine classification, contact person name, and telephone number (seeded as demo records).</li>
            <li><strong>NGO / Shelter Profiles:</strong> Organization title, receiving facility address, maximum meal intake capacity, current load, and supported food categories.</li>
            <li><strong>Food Donation Records:</strong> Item title, preparation timestamp, holding temperature (°C), packaging seal verification, quantity, and requested pickup window.</li>
            <li><strong>Coordination Audit Logs:</strong> Timestamps of human approvals, approver signature strings, version increments, and platform dispatch status transitions.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-heading font-bold text-sm text-primaryText">2. Purpose of Data Processing</h3>
          <p>
            The collected data is processed exclusively to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Evaluate compliance with FDA Food Code §3-501.19 temperature and elapsed-time public health limits.</li>
            <li>Calculate capacity compatibility between donors and recipient community organizations.</li>
            <li>Maintain an auditable, immutable trace of human approvals prior to platform dispatch creation.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-heading font-bold text-sm text-primaryText">3. Third-Party AI Service Integration</h3>
          <p>
            When configured with a valid API key, the platform utilizes <strong>Google Gemini (Gemini 2.5)</strong> to generate operational rationale summaries explaining why an NGO was matched. The data transmitted to the model consists solely of the donation category, elapsed minutes, holding temperature, and NGO capacity headroom. No personal customer data or financial data is transmitted. If the API is unreachable, the system automatically falls back to an offline deterministic rules engine.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-heading font-bold text-sm text-primaryText">4. Data Storage, Retention, and Reset</h3>
          <p>
            All records are stored locally within the SQLite database (<code className="bg-ivory px-1 py-0.5 rounded border border-borderLine text-primaryText">foodbridge.db</code>). Operators can instantly erase all transaction history and restore initial clean seed records at any time using the &quot;Reset Sandbox&quot; control in the top navigation bar.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-heading font-bold text-sm text-primaryText">5. Organization & Legal Review</h3>
          <p>
            Organization Contact: <code className="text-primaryText font-mono">[DEMO_PROJECT_COORDINATOR]</code> • Operating under synthetic demo parameters. This privacy statement has been authored for hackathon transparency and should be reviewed by legal counsel prior to commercial production deployment.
          </p>
        </section>
      </Card>
    </div>
  );
};
