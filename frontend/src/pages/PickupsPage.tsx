import React, { useEffect, useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { PickupRequest } from '../types';
import { getStatusMeta } from '../utils/status';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Info,
  ChevronDown,
  ChevronUp,
  XCircle,
  FileCode,
  Search,
  Database,
  Activity,
  Building2,
  Sparkles
} from 'lucide-react';

interface PickupsPageProps {
  onNavigate: (route: string) => void;
}

export const PickupsPage: React.FC<PickupsPageProps> = ({ onNavigate }) => {
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    targetId: string;
    message: string;
    type?: 'success' | 'info';
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'OPERATIONAL' | 'SCENARIO'>('ALL');

  // Location change modal state (TC4)
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [targetPickupId, setTargetPickupId] = useState<string>('');
  const [newLocationText, setNewLocationText] = useState<string>('Emergency Relief Annex — 88 South Street, Dock 3');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Approval modal state
  const [approverName, setApproverName] = useState<string>('Chef Marcus Lee (Store Lead)');

  // Independent agent verification & NGO actor state
  const [verifiedQueryState, setVerifiedQueryState] = useState<any | null>(null);
  const [isQueryingStatus, setIsQueryingStatus] = useState<boolean>(false);
  const [ngoActorName, setNgoActorName] = useState<string>('Driver David Morales (City Hope Rescue)');

  const isScenario = (p: PickupRequest) => p.id.startsWith('REQ-TC') || p.donation_id.startsWith('DON-TC');

  const filteredPickups = pickups.filter((p) => {
    if (activeTab === 'OPERATIONAL') return !isScenario(p);
    if (activeTab === 'SCENARIO') return isScenario(p);
    return true;
  });

  const loadPickups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getPickups();
      setPickups(data);
      const urlParams = new URLSearchParams(window.location.search);
      const targetId = urlParams.get('id');
      if (targetId && data.some(p => p.id === targetId)) {
        setSelectedPickupId(targetId);
      } else if (targetId) {
        setSelectedPickupId(targetId);
      } else if (data.length > 0 && !selectedPickupId) {
        setSelectedPickupId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load pickups.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPickups();
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id');
    if (targetId) {
      setSelectedPickupId(targetId);
    }
  }, []);

  const handleSelectPickup = (id: string) => {
    setSelectedPickupId(id);
    if (verifiedQueryState && verifiedQueryState.pickup_id !== id) {
      setVerifiedQueryState(null);
    }
    if (actionNotice && actionNotice.targetId !== id) {
      // Auto-dismiss or let user clear banner if switching to a different record
      setActionNotice(null);
    }
  };

  const handleApprove = async (id: string, version: number) => {
    try {
      setError(null);
      setSelectedPickupId(id);
      await api.approvePickup(id, approverName, version);
      setActionNotice({
        targetId: id,
        message: `Pickup ${id} approved (v${version}) by ${approverName}. Status held awaiting NGO acceptance.`
      });
      await loadPickups();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAcceptByNGO = async (id: string, version: number) => {
    try {
      setError(null);
      setActionNotice(null);
      setSelectedPickupId(id);
      await api.acceptPickup(id, {
        accepted_by: ngoActorName,
        expected_version: version
      });
      // Immediately perform independent agent query against mock platform
      const verifyRes = await api.verifyPickupStatus(id);
      setVerifiedQueryState({
        ...verifyRes,
        pickup_id: id
      });
      setActionNotice({
        targetId: id,
        message: `Recipient NGO acceptance confirmed on platform for ${id} (actor: ${ngoActorName}). Independent agent verification confirmed database status: ${verifyRes.retrieved_state.status}.`
      });
      await loadPickups();
    } catch (err: any) {
      setError(`Acceptance Guard: ${err.message}`);
    }
  };

  const handleQueryLiveStatus = async (id: string) => {
    try {
      setIsQueryingStatus(true);
      setError(null);
      setSelectedPickupId(id);
      const verifyRes = await api.verifyPickupStatus(id);
      setVerifiedQueryState({
        ...verifyRes,
        pickup_id: id
      });
      setActionNotice({
        targetId: id,
        message: `Agent queried mock platform database. State verified: "${verifyRes.retrieved_state.status}" (NGO Accepted: ${verifyRes.retrieved_state.accepted_by_ngo ? 'Yes' : 'No'}, Version: v${verifyRes.retrieved_state.approval_version}).`
      });
    } catch (err: any) {
      setError(`Platform Query Error: ${err.message}`);
    } finally {
      setIsQueryingStatus(false);
    }
  };

  const handleRejectByNGO = async (id: string) => {
    try {
      setError(null);
      setSelectedPickupId(id);
      await api.rejectPickup(id, 'Recipient facility emergency maintenance or capacity overload');
      setActionNotice({
        targetId: id,
        message: `Recipient NGO declined dispatch ${id}. Donation returned to Awaiting Match pool in platform database.`
      });
      await loadPickups();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChangeLocationSubmit = async () => {
    if (!targetPickupId || !newLocationText.trim()) return;
    setIsSubmitting(true);
    try {
      setError(null);
      setSelectedPickupId(targetPickupId);
      await api.changeLocation(targetPickupId, newLocationText, 'Operational facility maintenance');
      setActionNotice({
        targetId: targetPickupId,
        message: `Drop-off location changed for ${targetPickupId}. Previous human approval INVALIDATED. Version incremented. Reconfirmation required.`
      });
      setLocationModalOpen(false);
      await loadPickups();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCompletion = async (id: string) => {
    try {
      setError(null);
      setActionNotice(null);
      setSelectedPickupId(id);
      const res = await api.verifyCompletion(id);
      const verifyRes = await api.verifyPickupStatus(id);
      setVerifiedQueryState({
        ...verifyRes,
        pickup_id: id
      });
      setActionNotice({
        targetId: id,
        message: `Collection successfully verified for ${id}. Status marked Verified Complete in mock platform database.`
      });
      await loadPickups();
    } catch (err: any) {
      setError(`Platform Guard: ${err.message}`);
    }
  };

  const selectedPickup = filteredPickups.find((p) => p.id === selectedPickupId) ||
    pickups.find((p) => p.id === selectedPickupId) ||
    filteredPickups[0] ||
    pickups[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-borderLine">
        <div>
          <h2 className="text-xl font-bold font-heading text-primaryText tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-forest" />
            <span>Pickup Requests & Execution State Machine</span>
          </h2>
          <p className="text-xs text-secondaryText">
            Auditable lifecycle: Proposed → Human Approval → NGO Acceptance → Location Invalidation Gating → Verified Collection.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('/test-scenarios')}
        >
          Run Official Scenarios
        </Button>
      </div>

      {/* Mock Platform Operational Sandbox Banner */}
      <div className="p-3 rounded-[8px] bg-white border border-borderLine flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2 text-secondaryText">
          <ShieldCheck className="w-4 h-4 text-forest flex-shrink-0" />
          <span>
            <strong className="text-primaryText font-semibold">Mock Donation Platform (Official Challenge Target):</strong> Real LangGraph autonomous agent executing against the persistent platform database with cryptographic audit logging and human approval gating.
          </span>
        </div>
        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#EBF5EE] text-brandSuccess border border-[#C7E3D0] flex-shrink-0">
          PLATFORM API CONNECTED
        </span>
      </div>

      {/* Notifications */}
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

      {actionNotice && (
        <div className="p-3.5 rounded-[8px] bg-[#EBF5EE] border border-[#C7E3D0] text-brandSuccess text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-[#C7E3D0] text-primaryText">
              {actionNotice.targetId}
            </span>
            <span>{actionNotice.message}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {selectedPickup?.id !== actionNotice.targetId && (
              <button
                type="button"
                onClick={() => handleSelectPickup(actionNotice.targetId)}
                className="text-xs font-bold text-forest underline cursor-pointer hover:text-darkGreen"
              >
                Inspect {actionNotice.targetId}
              </button>
            )}
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="text-xs font-semibold text-secondaryText hover:text-primaryText hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {pickups.length === 0 ? (
        <Card padding="lg" className="text-center space-y-3">
          <Truck className="w-10 h-10 text-secondaryText/40 mx-auto" />
          <h3 className="font-heading font-bold text-base text-primaryText">No Dispatches Created Yet</h3>
          <p className="text-xs text-secondaryText max-w-sm mx-auto">
            Match a surplus food donation or run the official test scenarios to populate active dispatches.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button variant="primary" size="sm" onClick={() => onNavigate('/matching')}>
              Go to NGO Matching
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate('/test-scenarios')}>
              Run Scenarios
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Pickup List (Table View) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-secondaryText uppercase tracking-wider">
                Dispatches ({filteredPickups.length})
              </span>
              <span className="text-[11px] text-secondaryText">
                Select request to inspect
              </span>
            </div>

            {/* Filter Tabs: All vs Live Operational vs Scenario Artifacts */}
            <div className="flex items-center p-1 rounded-[7px] bg-[#FAFBF9] border border-borderLine text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`flex-1 py-1 px-2 rounded-[5px] text-[11px] font-medium transition-all ${
                  activeTab === 'ALL'
                    ? 'bg-white text-primaryText font-bold shadow-xs border border-borderLine'
                    : 'text-secondaryText hover:text-primaryText'
                }`}
              >
                All ({pickups.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('OPERATIONAL')}
                className={`flex-1 py-1 px-2 rounded-[5px] text-[11px] font-medium transition-all ${
                  activeTab === 'OPERATIONAL'
                    ? 'bg-white text-forest font-bold shadow-xs border border-forest/30'
                    : 'text-secondaryText hover:text-primaryText'
                }`}
              >
                Live Demo ({pickups.filter(p => !isScenario(p)).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('SCENARIO')}
                className={`flex-1 py-1 px-2 rounded-[5px] text-[11px] font-medium transition-all ${
                  activeTab === 'SCENARIO'
                    ? 'bg-white text-accent font-bold shadow-xs border border-accent/30'
                    : 'text-secondaryText hover:text-primaryText'
                }`}
              >
                Scenarios ({pickups.filter(p => isScenario(p)).length})
              </button>
            </div>

            <div className="space-y-2">
              {filteredPickups.length === 0 ? (
                <div className="p-4 rounded-[8px] bg-white border border-borderLine text-center text-xs text-secondaryText">
                  No dispatches found in this tab.
                </div>
              ) : (
                filteredPickups.map((p) => {
                  const isSelected = selectedPickup?.id === p.id;
                  const statusMeta = getStatusMeta(p.status, 'pickup');

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPickup(p.id)}
                      className={`p-3.5 rounded-[8px] border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white border-forest shadow-sm'
                          : 'bg-[#FAFBF9] border-borderLine hover:bg-white hover:border-forest/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primaryText">
                            {p.id}
                          </span>
                          <span className="text-[10px] font-mono text-secondaryText px-1.5 py-0.2 rounded bg-ivory border border-borderLine">
                            v{p.approval_version}
                          </span>
                        </div>
                        <Badge variant={statusMeta.variant} size="sm">
                          {statusMeta.label}
                        </Badge>
                      </div>

                      <div className="text-xs text-secondaryText space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span>Donation: <strong className="font-mono text-primaryText">{p.donation_id}</strong></span>
                          <span className="font-medium text-primaryText">{p.quantity} units</span>
                        </div>
                        <div className="text-[11px] text-secondaryText truncate" title={p.drop_off_location}>
                          NGO: <span className="font-medium text-primaryText">{p.ngo_id}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed Structured View */}
          {selectedPickup && (
            <div className="lg:col-span-7 space-y-5">
              {(() => {
                const statusMeta = getStatusMeta(selectedPickup.status, 'pickup');
                const isPendingApproval = selectedPickup.status === 'PROPOSED';
                const isReconfirmationNeeded = selectedPickup.status === 'RECONFIRMATION_REQUIRED';
                const isApprovedAwaitingNgo = selectedPickup.status === 'APPROVED' && !selectedPickup.accepted_by_ngo;
                const isNgoAccepted = selectedPickup.accepted_by_ngo && selectedPickup.status === 'ACCEPTED_BY_NGO';
                const isCompleted = selectedPickup.status === 'VERIFIED_COMPLETE' || selectedPickup.status === 'COLLECTED';

                return (
                  <Card padding="md" className="space-y-5 border-l-4 border-l-forest">
                    {/* 1. Clear Page Title & Current Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-borderLine">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="font-heading font-bold text-lg text-primaryText font-mono">
                            {selectedPickup.id}
                          </h3>
                          <Badge variant={statusMeta.variant}>
                            {statusMeta.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-secondaryText mt-0.5">
                          Proposal Version: <strong>v{selectedPickup.approval_version}</strong> • Created: {new Date(selectedPickup.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="text-right text-xs font-mono text-secondaryText">
                        Donation Ref: <strong className="text-primaryText">{selectedPickup.donation_id}</strong>
                      </div>
                    </div>

                    {/* 2. Prominent Location Alteration Warning if applicable (TC4) */}
                    {isReconfirmationNeeded && (
                      <div className="p-3.5 rounded-[8px] bg-[#FFFBFB] border border-[#F2C2BF] space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-brandError font-bold">
                          <MapPin className="w-4 h-4" />
                          <span>Drop-off Location Altered — Operator Reconfirmation Required (TC4)</span>
                        </div>
                        <p className="text-secondaryText leading-relaxed">
                          The recipient NGO modified the destination facility post-approval. Under governance rules, the previous approval has been <strong>invalidated</strong>, the version incremented to <strong>v{selectedPickup.approval_version}</strong>, and fresh restaurant sign-off is mandated.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                          <div className="p-2 rounded bg-white border border-borderLine">
                            <span className="text-secondaryText block text-[10px] uppercase">Original Location:</span>
                            <span className="text-primaryText">{selectedPickup.original_drop_off_location || 'Default Depot'}</span>
                          </div>
                          <div className="p-2 rounded bg-white border border-brandError/40">
                            <span className="text-brandError block text-[10px] uppercase font-bold">New Proposed Location:</span>
                            <span className="text-primaryText font-semibold">{selectedPickup.drop_off_location}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. Workflow Timeline */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-secondaryText uppercase tracking-wider block">
                        Lifecycle State Machine
                      </span>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2 rounded-[6px] bg-[#FAFBF9] border border-borderLine">
                          <span className="text-[10px] font-bold text-forest block">1. Proposed</span>
                          <span className="text-[11px] text-brandSuccess font-semibold">Done</span>
                        </div>
                        <div className={`p-2 rounded-[6px] border ${
                          selectedPickup.approved_by
                            ? 'bg-[#EBF5EE] border-[#C7E3D0] text-brandSuccess'
                            : isPendingApproval || isReconfirmationNeeded
                            ? 'bg-[#FDF3E7] border-[#F2D7B3] text-brandWarning font-semibold'
                            : 'bg-white border-borderLine text-secondaryText'
                        }`}>
                          <span className="text-[10px] font-bold block">2. Approval</span>
                          <span className="text-[11px]">
                            {selectedPickup.approved_by ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                        <div className={`p-2 rounded-[6px] border ${
                          selectedPickup.accepted_by_ngo
                            ? 'bg-[#EBF5EE] border-[#C7E3D0] text-brandSuccess'
                            : 'bg-white border-borderLine text-secondaryText'
                        }`}>
                          <span className="text-[10px] font-bold block">3. NGO Accept</span>
                          <span className="text-[11px]">
                            {selectedPickup.accepted_by_ngo ? 'Accepted' : 'Pending'}
                          </span>
                        </div>
                        <div className={`p-2 rounded-[6px] border ${
                          isCompleted
                            ? 'bg-[#EBF5EE] border-[#C7E3D0] text-brandSuccess font-semibold'
                            : 'bg-white border-borderLine text-secondaryText'
                        }`}>
                          <span className="text-[10px] font-bold block">4. Verified</span>
                          <span className="text-[11px]">
                            {isCompleted ? 'Complete' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4. Donation & Pickup Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-ivory/60 p-3.5 rounded-[8px] border border-borderLine">
                      <div>
                        <span className="text-secondaryText text-[11px] block">Target NGO ID:</span>
                        <strong className="text-primaryText font-mono text-sm">{selectedPickup.ngo_id}</strong>
                      </div>
                      <div>
                        <span className="text-secondaryText text-[11px] block">Quantity Dispatched:</span>
                        <strong className="text-primaryText text-sm">{selectedPickup.quantity} units</strong>
                      </div>
                      <div>
                        <span className="text-secondaryText text-[11px] block">Drop-off Destination:</span>
                        <div className="flex items-center gap-1.5 font-medium text-primaryText mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-forest flex-shrink-0" />
                          <span>{selectedPickup.drop_off_location}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-secondaryText text-[11px] block">Human Approval Audit:</span>
                        <div className="mt-0.5">
                          {selectedPickup.approved_by ? (
                            <span className="text-brandSuccess font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approved by {selectedPickup.approved_by}
                            </span>
                          ) : (
                            <span className="text-brandWarning font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Not Approved / Prior Approval Cleared
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 5. Approval & Action Controls Categorized By Actor */}
                    <div className="space-y-4 pt-3 border-t border-borderLine">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-secondaryText uppercase tracking-wider">
                          Lifecycle Control Panel (Role-Separated)
                        </span>
                        <span className="text-[10px] text-secondaryText bg-ivory px-2 py-0.5 rounded border border-borderLine">
                          Simulates Real-World Multi-Party Interaction
                        </span>
                      </div>

                      {/* Group A: Human Store Manager Gating (Step 04) */}
                      {(isPendingApproval || isReconfirmationNeeded) && (
                        <div className="p-3 rounded-[8px] bg-amber-50/60 border border-amber-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-amber-700" />
                              👤 Store Manager Sign-Off (Mandated by Hackathon Step 04)
                            </span>
                            <Badge variant="warning" size="sm">Human Approval Gate</Badge>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            The AI Agent matched the NGO and formulated this proposal. Before food leaves the store, human approval is mandatory to prevent unauthorized donation of inventory.
                          </p>
                          <div className="pt-1">
                            {isPendingApproval && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleApprove(selectedPickup.id, selectedPickup.approval_version)}
                                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              >
                                Approve Proposal (Sign Off)
                              </Button>
                            )}
                            {isReconfirmationNeeded && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleApprove(selectedPickup.id, selectedPickup.approval_version)}
                                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              >
                                Reconfirm New Location (v{selectedPickup.approval_version})
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Group B: Recipient NGO Portal Simulation (External Counter-Party) */}
                      {(isApprovedAwaitingNgo || isNgoAccepted) && (
                        <div className="p-3 rounded-[8px] bg-blue-50/50 border border-blue-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-blue-700" />
                              🏢 Recipient NGO Portal (External Charity Simulation)
                            </span>
                            <Badge variant="info" size="sm">Counter-Party Portal</Badge>
                          </div>
                          <p className="text-[11px] text-blue-800 leading-relaxed">
                            An AI agent cannot force an outside charity to accept food. In production, the recipient NGO driver receives the dispatch on their app. Use these buttons to simulate their response.
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {isApprovedAwaitingNgo && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleAcceptByNGO(selectedPickup.id, selectedPickup.approval_version)}
                                  icon={<UserCheck className="w-3.5 h-3.5 text-forest" />}
                                >
                                  NGO Portal: Confirm Acceptance
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRejectByNGO(selectedPickup.id)}
                                  icon={<XCircle className="w-3.5 h-3.5 text-brandError" />}
                                  title="Recipient NGO declines dispatch in platform portal; donation returned to matching pool"
                                >
                                  NGO Portal: Decline
                                </Button>
                              </>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTargetPickupId(selectedPickup.id);
                                locationModalOpen ? null : setLocationModalOpen(true);
                              }}
                              icon={<MapPin className="w-3.5 h-3.5 text-accent" />}
                              title="Recipient NGO alters drop-off facility in platform portal; triggers approval invalidation"
                            >
                              NGO Portal: Update Location
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Group C: Autonomous Agent Query Tool & Physical Handover */}
                      <div className="p-3 rounded-[8px] bg-emerald-50/40 border border-emerald-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-forest flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-forest" />
                            🤖 AI Agent Tools & Physical Completion
                          </span>
                          <Badge variant="success" size="sm">Agent Tool Calling</Badge>
                        </div>
                        <p className="text-[11px] text-secondaryText leading-relaxed">
                          The Agent uses its dedicated tool <code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded border border-borderLine">tool_get_pickup_status</code> to poll the platform ledger directly without relying on stale local cache.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQueryLiveStatus(selectedPickup.id)}
                            isLoading={isQueryingStatus}
                            icon={<Search className="w-3.5 h-3.5 text-forest" />}
                            title="Run agent independent status-verification tool against Mock Donation Platform"
                          >
                            Agent: Query Platform Status
                          </Button>

                          {!isCompleted && (
                            <Button
                              variant={isNgoAccepted ? 'primary' : 'outline'}
                              size="sm"
                              onClick={() => handleVerifyCompletion(selectedPickup.id)}
                              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              title={
                                isNgoAccepted
                                  ? 'Verify physical handoff at kitchen door'
                                  : 'State machine guard: Cannot verify collection until recipient NGO accepts dispatch'
                              }
                            >
                              Physical Driver Handover (Verify Collection)
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Recipient Acknowledgment Notice */}
                      {isApprovedAwaitingNgo && (
                        <div className="p-2.5 rounded-[6px] bg-[#FAFBF9] border border-borderLine text-[11px] text-secondaryText flex items-start gap-2">
                          <Info className="w-3.5 h-3.5 text-forest flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Recipient Acknowledgment Pending:</strong> Dispatch is awaiting confirmation in the recipient NGO platform portal. Physical collection verification remains locked until accepted.
                          </span>
                        </div>
                      )}

                      {/* 6. Live Independent Platform State & Audit Evidence */}
                      {(() => {
                        const isVerifiedMatching = Boolean(
                          verifiedQueryState && 
                          (verifiedQueryState.pickup_id === selectedPickup.id || verifiedQueryState.retrieved_state?.pickup_id === selectedPickup.id)
                        );
                        return (
                          <div className={`pt-3 border-t border-borderLine space-y-2.5 transition-all ${
                            isVerifiedMatching ? 'bg-[#F4FAF6] -mx-4 px-4 py-3 rounded-b-[8px] border-t-2 border-t-brandSuccess' : ''
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-secondaryText uppercase tracking-wider flex items-center gap-1.5">
                                <Database className="w-3.5 h-3.5 text-forest" />
                                <span>Independently Verified Platform State (SQLite Ledger)</span>
                              </span>
                              {isVerifiedMatching ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-brandSuccess border border-[#C7E3D0] font-bold flex items-center gap-1 shadow-2xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-brandSuccess" />
                                  <span>VERIFIED LIVE AT {new Date(verifiedQueryState.query_timestamp).toLocaleTimeString()}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-secondaryText">
                                  Live Database Record
                                </span>
                              )}
                            </div>

                            {/* Direct Feedback Callout when tool executes */}
                            {isVerifiedMatching && (
                              <div className="p-2.5 rounded-[6px] bg-white border border-[#C7E3D0] text-xs text-brandSuccess flex items-start gap-2 shadow-2xs">
                                <CheckCircle2 className="w-4 h-4 text-brandSuccess flex-shrink-0 mt-0.5" />
                                <div className="space-y-0.5 text-primaryText">
                                  <strong className="text-brandSuccess block font-heading">
                                    Agent Query Tool Confirmed Database State:
                                  </strong>
                                  <span className="text-secondaryText text-[11px]">
                                    Direct query against SQLite mock platform confirms dispatch <code className="font-mono font-bold text-primaryText bg-ivory px-1 rounded border border-borderLine">{selectedPickup.id}</code> is currently <strong>{verifiedQueryState.retrieved_state?.status}</strong> (NGO Accepted: {verifiedQueryState.retrieved_state?.accepted_by_ngo ? 'Yes' : 'No'}, Version: v{verifiedQueryState.retrieved_state?.approval_version}).
                                  </span>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                              <div className="p-2 rounded bg-white border border-borderLine">
                                <span className="text-secondaryText block text-[10px] uppercase font-sans">Database Status:</span>
                                <strong className="text-primaryText">{isVerifiedMatching ? verifiedQueryState.retrieved_state.status : selectedPickup.status}</strong>
                              </div>
                              <div className="p-2 rounded bg-white border border-borderLine">
                                <span className="text-secondaryText block text-[10px] uppercase font-sans">NGO Acceptance:</span>
                                <span className={(isVerifiedMatching ? verifiedQueryState.retrieved_state.accepted_by_ngo : selectedPickup.accepted_by_ngo) ? 'text-brandSuccess font-bold' : 'text-brandWarning font-semibold'}>
                                  {(isVerifiedMatching ? verifiedQueryState.retrieved_state.accepted_by_ngo : selectedPickup.accepted_by_ngo) ? 'Accepted by NGO' : 'Awaiting NGO'}
                                </span>
                              </div>
                              <div className="p-2 rounded bg-white border border-borderLine">
                                <span className="text-secondaryText block text-[10px] uppercase font-sans">Approval Version:</span>
                                <span className="text-primaryText font-bold">v{(isVerifiedMatching ? verifiedQueryState.retrieved_state.approval_version : selectedPickup.approval_version)}</span>
                              </div>
                              <div className="p-2 rounded bg-white border border-borderLine">
                                <span className="text-secondaryText block text-[10px] uppercase font-sans">Physical Handoff:</span>
                                <span className={(isVerifiedMatching ? verifiedQueryState.retrieved_state.collected_at : selectedPickup.collected_at) ? 'text-brandSuccess font-bold' : 'text-secondaryText'}>
                                  {(isVerifiedMatching ? verifiedQueryState.retrieved_state.collected_at : selectedPickup.collected_at) ? 'Verified Complete' : 'Pending Receipt'}
                                </span>
                              </div>
                            </div>

                            {selectedPickup.accepted_at && (
                              <div className="text-[11px] text-secondaryText bg-white p-2 rounded border border-borderLine flex items-center justify-between">
                                <span>NGO Acceptance Timestamp: <strong className="font-mono text-primaryText">{new Date(selectedPickup.accepted_at).toLocaleString()}</strong></span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-ivory text-forest border border-forest/20 font-mono">CONFIRMED IN DB</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </Card>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Location Change Modal (NGO Portal Destination Update) */}
      {locationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[10px] max-w-md w-full p-6 space-y-4 border border-borderLine shadow-lg">
            <div className="flex items-center gap-2 pb-3 border-b border-borderLine">
              <MapPin className="w-5 h-5 text-accent" />
              <h3 className="font-heading font-bold text-base text-primaryText">
                NGO Portal: Update Drop-off Destination
              </h3>
            </div>

            <p className="text-xs text-secondaryText leading-relaxed">
              When a recipient NGO modifies their intake facility post-approval, the agent governance system automatically invalidates the existing human sign-off, increments the proposal version, and halts until human operator reconfirmation.
            </p>

            <div>
              <label className="block text-xs font-semibold text-primaryText mb-1.5">
                New Drop-off Destination:
              </label>
              <input
                type="text"
                value={newLocationText}
                onChange={(e) => setNewLocationText(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-borderLine">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocationModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleChangeLocationSubmit}
                isLoading={isSubmitting}
              >
                Apply Location Change
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
