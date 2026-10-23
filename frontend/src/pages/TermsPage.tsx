import React from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ArrowLeft, FileText, AlertTriangle, UserCheck, ShieldAlert } from 'lucide-react';
import { PRODUCT_NAME } from '../config';

interface TermsPageProps {
  onNavigate: (route: string) => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onNavigate }) => {
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
          <FileText className="w-3.5 h-3.5" />
          <span>Operational Terms</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-primaryText tracking-tight">
          Terms & Conditions of Service
        </h2>
        <p className="text-xs text-secondaryText">
          Intended demonstration usage, operator responsibilities, and food safety limitations.
        </p>
      </div>

      {/* Safety Notice */}
      <div className="p-4 rounded-[8px] bg-[#FEFAF5] border border-[#F2D7B3] text-xs text-brandWarning leading-relaxed space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Important Food-Safety & Legal Disclaimer</span>
        </div>
        <p>
          This platform is an operational agent system executing against the Mock Donation Platform target specified in the hackathon brief. Food rescue operations in actual commercial environments require physical inspection by certified food managers, continuous cold/hot chain telemetry, and compliance with local municipal health department ordinances.
        </p>
      </div>

      <Card padding="md" className="space-y-5 text-xs text-secondaryText leading-relaxed">
        <section className="space-y-2">
          <h3 className="font-heading font-bold text-sm text-primaryText">1. Demonstration Scope & Synthetic Data</h3>
          <p>
            {PRODUCT_NAME} is provided strictly as a technical demonstration. All restaurant identities, community organizations, volunteer contacts, and addresses presented in the default sandbox are synthetic demonstration records.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-heading font-bold text-sm text-primaryText">2. Mandatory Human Approval</h3>
          <p>
            Consequential logistics actions (including pickup dispatch authorization, acceptance, and reconfirmation upon facility changes) require explicit human interaction. The artificial intelligence components are designed to suggest matches and generate operational explanations; they do not possess autonomous authority to dispatch vehicles or collect food.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-heading font-bold text-sm text-primaryText">3. Food Safety Gating</h3>
          <p>
            The platform enforces deterministic constraints based on FDA Food Code §3-501.19 (Time as a Public Health Control). In any scenario where a food donation exceeds the configured maximum elapsed holding duration (240 minutes for ambient/hot prepared food, or 24 hours for refrigerated food), the platform automatically rejects the submission. Operators are prohibited from overriding this safety barrier.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-heading font-bold text-sm text-primaryText">4. Location Invalidation Protocol (TC4)</h3>
          <p>
            If a recipient organization modifies the drop-off delivery location after initial restaurant approval, the platform automatically invalidates the consent and mandates reconfirmation under an updated version number. Operators must verify the suitability of the modified facility before reconfirming.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-heading font-bold text-sm text-primaryText">5. Legal Organization Review</h3>
          <p>
            Governing Entity: <code className="text-primaryText font-mono">[HACKATHON_DEMO_PROJECT]</code>. Formal commercial deployment requires independent legal review, food donor liability assessment under applicable Good Samaritan legislation (such as the Bill Emerson Good Samaritan Food Donation Act), and public health authority validation.
          </p>
        </section>
      </Card>
    </div>
  );
};
