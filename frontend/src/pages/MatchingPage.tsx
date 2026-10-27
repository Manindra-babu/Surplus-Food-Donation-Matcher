import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { Donation, MatchingEvaluationResponse } from '../types';
import { getStatusMeta } from '../utils/status';
import { formatISTTime } from '../utils/time';
import {
  Network,
  Sparkles,
  ShieldCheck,
  Scale,
  Clock,
  Thermometer,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
  ArrowRight,
  Info,
  MapPin,
  Bot,
  ChevronDown,
  ChevronUp,
  FileCode
} from 'lucide-react';

interface MatchingPageProps {
  onNavigate: (route: string) => void;
}

export const MatchingPage: React.FC<MatchingPageProps> = ({ onNavigate }) => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [selectedDonationId, setSelectedDonationId] = useState<string>('');
  const [evaluation, setEvaluation] = useState<MatchingEvaluationResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Human approval modal state
  const [approvalModalOpen, setApprovalModalOpen] = useState<boolean>(false);
  const [approverName, setApproverName] = useState<string>('Chef Marcus Lee (Store Lead)');
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);
  const [isTraceExpanded, setIsTraceExpanded] = useState<boolean>(false);

  const loadDonations = async () => {
    try {
      const data = await api.getDonations();
      setDonations(data);
      if (data.length > 0 && !selectedDonationId) {
        const awaiting = data.find((d) => d.status === 'AWAITING_MATCH');
        setSelectedDonationId(awaiting ? awaiting.id : data[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadDonations();
  }, []);

  const selectedDonation = donations.find((d) => d.id === selectedDonationId);

  const handleRunMatching = async () => {
    if (!selectedDonationId) return;
    setIsEvaluating(true);
    setError(null);
    setEvaluation(null);
    setApprovalSuccess(null);

    try {
      const result = await api.evaluateMatching(selectedDonationId);
      setEvaluation(result);
    } catch (err: any) {
      setError(err.message || 'Agent evaluation failed.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleApproveProposal = async () => {
    if (!evaluation || !evaluation.pickup_request_id) return;
    setIsApproving(true);
    setError(null);
    try {
      await api.approvePickup(evaluation.pickup_request_id, approverName, 1);
      setApprovalSuccess(
        `Pickup proposal ${evaluation.pickup_request_id} successfully approved by ${approverName}. Resulting platform status verified in database.`
      );
      setApprovalModalOpen(false);
      await loadDonations();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to approve pickup.';
      if (errMsg.includes('not found') || errMsg.includes('404')) {
        setError(`Proposal ${evaluation.pickup_request_id} expired or database was reset. Refreshing matching...`);
        setApprovalModalOpen(false);
        setEvaluation(null);
        if (selectedDonationId) {
          setTimeout(() => {
            handleRunMatching();
          }, 400);
        }
      } else {
        setError(errMsg);
      }
    } finally {
      setIsApproving(false);
    }
  };

  const donationStatusMeta = selectedDonation ? getStatusMeta(selectedDonation.status, 'donation') : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-borderLine">
        <div>
          <h2 className="text-xl font-bold font-heading text-primaryText tracking-tight flex items-center gap-2">
            <Network className="w-5 h-5 text-forest" />
            <span>NGO Matching & Agent Reasoning</span>
          </h2>
          <p className="text-xs text-secondaryText">
            Deterministic food-safety validation, candidate capacity evaluation, and human operator approval gating.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('/pickups')}
        >
          View Pickup Dispatches
        </Button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-[8px] bg-[#FBEBEA] border border-[#F2C2BF] text-brandError text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-semibold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Success Banner */}
      {approvalSuccess && (
        <div className="p-3.5 rounded-[8px] bg-[#EBF5EE] border border-[#C7E3D0] text-brandSuccess text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{approvalSuccess}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('/pickups')}>
            Inspect Pickup Ledger
          </Button>
        </div>
      )}

      {/* Donation Selection Workbench */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-primaryText mb-1.5">
              Select Prepared Surplus Batch:
            </label>
            <select
              value={selectedDonationId}
              onChange={(e) => {
                setSelectedDonationId(e.target.value);
                setEvaluation(null);
                setApprovalSuccess(null);
              }}
              className="w-full sm:max-w-xl px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText"
            >
              {donations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} — {d.food_name} ({d.quantity} {d.unit}, {d.status.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="primary"
            onClick={handleRunMatching}
            isLoading={isEvaluating}
            icon={<Sparkles className="w-4 h-4" />}
            className="sm:self-end"
          >
            Evaluate & Match
          </Button>
        </div>

        {/* Selected Donation Meta */}
        {selectedDonation && donationStatusMeta && (
          <div className="pt-3 border-t border-borderLine grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-ivory/60 p-3 rounded-[8px]">
            <div>
              <span className="text-secondaryText block text-[11px]">Origin Restaurant:</span>
              <strong className="text-primaryText">{selectedDonation.restaurant_name}</strong>
            </div>
            <div>
              <span className="text-secondaryText block text-[11px]">Storage Temp:</span>
              <span className="font-mono text-primaryText font-semibold">{selectedDonation.storage_temp_celsius}°C</span>
            </div>
            <div>
              <span className="text-secondaryText block text-[11px]">Quantity:</span>
              <span className="text-primaryText font-semibold">{selectedDonation.quantity} {selectedDonation.unit}</span>
            </div>
            <div>
              <span className="text-secondaryText block text-[11px]">Current Status:</span>
              <Badge variant={donationStatusMeta.variant} size="sm">
                {donationStatusMeta.label}
              </Badge>
            </div>
          </div>
        )}
      </Card>

      {/* Agent Evaluation Output */}
      {evaluation && (
        <div className="space-y-6">
          {/* Stage 2: Food-Safety Validation */}
          <Card
            padding="md"
            className={
              evaluation.food_safety_passed
                ? 'bg-[#FAFCF9] border-[#D4E4D3]'
                : 'bg-[#FFFBFB] border-[#F2C2BF]'
            }
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {evaluation.food_safety_passed ? (
                  <CheckCircle2 className="w-5 h-5 text-brandSuccess mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-brandError mt-0.5 flex-shrink-0" />
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-sm text-primaryText">
                      Stage 2: Deterministic Food-Safety Policy Validation
                    </h3>
                    <Badge variant={evaluation.food_safety_passed ? 'success' : 'danger'}>
                      {evaluation.food_safety_passed ? 'Passed §3-501.19' : 'Rejected for Safety'}
                    </Badge>
                  </div>
                  <p className="text-xs text-secondaryText leading-relaxed">
                    {evaluation.safety_evaluation.reason}
                  </p>
                  <p className="text-[11px] text-secondaryText font-mono">
                    Policy Standard: {evaluation.safety_evaluation.policy_reference}
                  </p>
                </div>
              </div>

              <div className="text-right text-xs font-mono text-secondaryText flex-shrink-0">
                <div>Elapsed: <strong>{evaluation.safety_evaluation.elapsed_minutes}m</strong></div>
                <div>Limit: {evaluation.safety_evaluation.max_allowed_minutes}m</div>
              </div>
            </div>
          </Card>

          {/* If Safety Failed: Statutory Block Notice */}
          {!evaluation.food_safety_passed && (
            <Card padding="md" className="border-brandError/30 bg-[#FFFBFB] space-y-2">
              <div className="flex items-center gap-2 text-brandError text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Dispatch Blocked by Governance Policy</span>
              </div>
              <p className="text-xs text-secondaryText leading-relaxed">
                As required by FDA Food Code §3-501.19 Time-as-a-Public-Health-Control, donations exceeding permitted holding limits cannot be proposed or assigned to community partners. An AI model is strictly prohibited from overriding this constraint.
              </p>
            </Card>
          )}

          {/* If Safety Passed: Recommended Match & Operator Proposal */}
          {evaluation.food_safety_passed && evaluation.recommended_ngo && (
            <div className="space-y-5">
              {/* Proposal & Human Approval Card */}
              <div className="p-5 rounded-[10px] bg-white border-2 border-forest shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-borderLine">
                  <div>
                    <span className="text-[11px] font-bold text-forest uppercase tracking-wider block">
                      Pickup Proposal Pending Review
                    </span>
                    <h3 className="font-heading font-bold text-base text-primaryText">
                      Recommended NGO: {evaluation.recommended_ngo.ngo_name}
                    </h3>
                    <span className="text-xs text-secondaryText font-mono">
                      Request ID: {evaluation.pickup_request_id || 'PROPOSED'}
                    </span>
                  </div>

                  <Badge variant="warning">
                    Awaiting Human Approval
                  </Badge>
                </div>

                {/* Pre-Approval Summary as required in Section 7 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#FAFBF9] p-3.5 rounded-[8px] border border-borderLine">
                  <div>
                    <span className="text-secondaryText text-[11px] block">Recipient Partner:</span>
                    <strong className="text-primaryText">{evaluation.recommended_ngo.ngo_name}</strong>
                  </div>
                  <div>
                    <span className="text-secondaryText text-[11px] block">Matching Score:</span>
                    <span className="font-mono text-primaryText font-bold text-forest">
                      {evaluation.recommended_ngo.score.toFixed(1)} / 100
                    </span>
                  </div>
                  <div>
                    <span className="text-secondaryText text-[11px] block">Intake Capacity:</span>
                    <span className="font-mono text-primaryText font-semibold">
                      {evaluation.recommended_ngo.capacity_available} meals available
                    </span>
                  </div>
                  <div>
                    <span className="text-secondaryText text-[11px] block">Distance:</span>
                    <span className="font-mono text-primaryText">
                      ~{evaluation.recommended_ngo.estimated_distance_km.toFixed(1)} km
                    </span>
                  </div>
                </div>

                {/* Algorithmic & LLM Matching Rationale */}
                {evaluation.explanation && (
                  <div className="p-3 rounded-[7px] bg-ivory border border-borderLine space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primaryText">
                      <Bot className="w-3.5 h-3.5 text-forest" />
                      <span>Matching Rationale ({evaluation.is_llm ? 'Google Gemini 2.5 Synthesized' : 'Rules Engine'})</span>
                    </div>
                    <p className="text-xs text-secondaryText leading-relaxed">
                      {evaluation.explanation}
                    </p>
                  </div>
                )}

                {/* Human Operator Sign-Off Action */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-secondaryText flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-forest flex-shrink-0" />
                    <span>No consequential dispatch executes automatically. Human sign-off is mandatory.</span>
                  </div>

                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setApprovalModalOpen(true)}
                    icon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Approve Pickup Proposal
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Technical Execution Trace (Collapsible) */}
          {evaluation.trace && evaluation.trace.length > 0 && (
            <div className="pt-2">
              <Card padding="md" className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-borderLine">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-forest" />
                    <span className="text-xs font-bold text-primaryText uppercase tracking-wider">
                      Technical Execution Trace ({evaluation.trace.length} Stages)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTraceExpanded(!isTraceExpanded)}
                    className="text-xs text-forest hover:text-forest-dark font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isTraceExpanded ? 'Collapse Trace' : 'Expand Trace'}</span>
                    {isTraceExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {isTraceExpanded && (
                  <div className="space-y-2 pt-2">
                    {evaluation.trace.map((step) => (
                      <div
                        key={step.step_number}
                        className="p-2.5 rounded-[6px] bg-[#FAFBF9] border border-borderLine text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-primaryText">
                            Stage {step.step_number}: {step.stage}
                          </span>
                          <span className="font-mono text-[10px] text-secondaryText">
                            {formatISTTime(step.timestamp)}
                          </span>
                        </div>
                        <p className="text-secondaryText text-[11px] leading-relaxed">
                          {step.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Human Operator Sign-Off Modal */}
      {approvalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[10px] max-w-md w-full p-6 space-y-4 border border-borderLine shadow-lg">
            <div className="flex items-center gap-2 pb-3 border-b border-borderLine">
              <UserCheck className="w-5 h-5 text-forest" />
              <h3 className="font-heading font-bold text-base text-primaryText">
                Confirm Human Approval
              </h3>
            </div>

            <p className="text-xs text-secondaryText leading-relaxed">
              By confirming, you authorize this surplus food dispatch to proceed to the next stage in the state machine (Proposal v1).
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-primaryText">
                Authorizing Operator Signature *
              </label>
              <input
                type="text"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText"
                placeholder="e.g. Chef Marcus Lee (Store Lead)"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-borderLine">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApprovalModalOpen(false)}
                disabled={isApproving}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleApproveProposal}
                isLoading={isApproving}
              >
                Sign Off & Authorize
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
