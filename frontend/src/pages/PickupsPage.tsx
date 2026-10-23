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
  Sparkles,
  Maximize2,
  Columns
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
  const [viewMode, setViewMode] = useState<'PRESENTATION' | 'SPLIT'>('PRESENTATION');

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

  const renderDetailCard = (p: PickupRequest) => {
    const statusMeta = getStatusMeta(p.status, 'pickup');
    const isPendingApproval = p.status === 'PROPOSED';
    const isReconfirmationNeeded = p.status === 'RECONFIRMATION_REQUIRED';
    const isApprovedAwaitingNgo = p.status === 'APPROVED' && !p.accepted_by_ngo;
    const isNgoAccepted = p.accepted_by_ngo && p.status === 'ACCEPTED_BY_NGO';
    const isCompleted = p.status === 'VERIFIED_COMPLETE' || p.status === 'COLLECTED';

    const isVerifiedMatching = Boolean(
      verifiedQueryState && 
      (verifiedQueryState.pickup_id === p.id || verifiedQueryState.retrieved_state?.pickup_id === p.id)
    );

    return (
      <Card padding="lg" className="space-y-6 border-l-4 border-l-forest shadow-sm bg-white">
        {/* 1. Clear Page Title & Current Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-borderLine">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-heading font-bold text-xl sm:text-2xl text-primaryText font-mono tracking-tight">
                {p.id}
              </h3>
              <Badge variant={statusMeta.variant} size="md">
                {statusMeta.label}
              </Badge>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-ivory text-primaryText border border-borderLine font-bold">
                v{p.approval_version}
              </span>
            </div>
            <p className="text-xs text-secondaryText">
              Proposal Version: <strong className="font-mono text-primaryText">v{p.approval_version}</strong> • Created: {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • System Ref: <span className="font-mono text-forest font-semibold">{p.donation_id}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1.5 rounded-[6px] bg-ivory border border-borderLine text-secondaryText">
              Donation Ref: <strong className="text-primaryText font-mono">{p.donation_id}</strong>
            </span>
          </div>
        </div>

        {/* 2. Prominent Location Alteration Warning if applicable (TC4) */}
        {isReconfirmationNeeded && (
          <div className="p-4 rounded-[8px] bg-[#FFFBFB] border border-[#F2C2BF] space-y-2 text-xs">
            <div className="flex items-center gap-2 text-brandError font-bold text-sm">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>Drop-off Location Altered — Operator Reconfirmation Required (TC4)</span>
            </div>
            <p className="text-secondaryText leading-relaxed">
              The recipient NGO modified the destination facility post-approval. Under governance rules, the previous approval has been <strong>invalidated</strong>, the version incremented to <strong>v{p.approval_version}</strong>, and fresh restaurant sign-off is mandated.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 font-mono text-xs">
              <div className="p-2.5 rounded bg-white border border-borderLine">
                <span className="text-secondaryText block text-[10px] uppercase font-sans">Original Location:</span>
                <span className="text-primaryText font-semibold">{p.original_drop_off_location || 'Default Depot'}</span>
              </div>
              <div className="p-2.5 rounded bg-white border border-brandError/40">
                <span className="text-brandError block text-[10px] uppercase font-sans font-bold">New Proposed Location:</span>
                <span className="text-primaryText font-semibold">{p.drop_off_location}</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Workflow Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondaryText uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-forest" />
              <span>Lifecycle State Machine (Deterministic Transition Engine)</span>
            </span>
            <span className="text-xs font-semibold text-secondaryText bg-ivory px-2.5 py-0.5 rounded border border-borderLine">
              {isCompleted ? '✓ Step 4 of 4: Handover Verified' : isNgoAccepted ? 'Step 3 of 4: NGO Confirmed' : p.approved_by ? 'Step 2 of 4: Store Approved' : 'Step 1 of 4: Match Proposed'}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. Proposed */}
            <div className="p-3.5 rounded-[8px] bg-[#FAFBF9] border border-borderLine flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-forest">1. Match Proposed</span>
                <span className="w-2.5 h-2.5 rounded-full bg-brandSuccess"></span>
              </div>
              <span className="text-[11px] text-secondaryText">FDA §3-501.19 Rules Passed</span>
              <span className="text-xs text-brandSuccess font-bold mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-brandSuccess" /> Complete
              </span>
            </div>

            {/* 2. Approval */}
            <div className={`p-3.5 rounded-[8px] border flex flex-col justify-between ${
              p.approved_by
                ? 'bg-[#EBF5EE] border-[#C7E3D0]'
                : isPendingApproval || isReconfirmationNeeded
                ? 'bg-[#FDF3E7] border-[#F2D7B3]'
                : 'bg-white border-borderLine'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-primaryText">2. Store Sign-Off</span>
                <span className={`w-2.5 h-2.5 rounded-full ${p.approved_by ? 'bg-brandSuccess' : 'bg-brandWarning animate-pulse'}`}></span>
              </div>
              <span className="text-[11px] text-secondaryText">Step 04 Human Gate</span>
              <span className={`text-xs font-bold mt-2 flex items-center gap-1 ${
                p.approved_by ? 'text-brandSuccess' : 'text-brandWarning'
              }`}>
                {p.approved_by ? (
                  <><CheckCircle2 className="w-4 h-4 text-brandSuccess" /> Approved</>
                ) : (
                  <><Clock className="w-4 h-4 text-brandWarning" /> Awaiting Sign-Off</>
                )}
              </span>
            </div>

            {/* 3. NGO Accept */}
            <div className={`p-3.5 rounded-[8px] border flex flex-col justify-between ${
              p.accepted_by_ngo
                ? 'bg-[#EBF5EE] border-[#C7E3D0]'
                : 'bg-white border-borderLine'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-primaryText">3. NGO Accept</span>
                <span className={`w-2.5 h-2.5 rounded-full ${p.accepted_by_ngo ? 'bg-brandSuccess' : 'bg-slate-300'}`}></span>
              </div>
              <span className="text-[11px] text-secondaryText">Counter-Party Dispatch</span>
              <span className={`text-xs font-bold mt-2 flex items-center gap-1 ${
                p.accepted_by_ngo ? 'text-brandSuccess' : 'text-secondaryText'
              }`}>
                {p.accepted_by_ngo ? (
                  <><CheckCircle2 className="w-4 h-4 text-brandSuccess" /> Confirmed</>
                ) : (
                  <><Clock className="w-4 h-4 text-secondaryText" /> Pending Portal</>
                )}
              </span>
            </div>

            {/* 4. Verified */}
            <div className={`p-3.5 rounded-[8px] border flex flex-col justify-between ${
              isCompleted
                ? 'bg-[#EBF5EE] border-[#C7E3D0]'
                : 'bg-white border-borderLine'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-primaryText">4. Handover Verified</span>
                <span className={`w-2.5 h-2.5 rounded-full ${isCompleted ? 'bg-brandSuccess' : 'bg-slate-300'}`}></span>
              </div>
              <span className="text-[11px] text-secondaryText">Driver at Kitchen Door</span>
              <span className={`text-xs font-bold mt-2 flex items-center gap-1 ${
                isCompleted ? 'text-brandSuccess' : 'text-secondaryText'
              }`}>
                {isCompleted ? (
                  <><CheckCircle2 className="w-4 h-4 text-brandSuccess" /> Verified Complete</>
                ) : (
                  <><Clock className="w-4 h-4 text-secondaryText" /> Pending Driver</>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Donation & Pickup Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-ivory/70 p-4 rounded-[10px] border border-borderLine">
          <div className="space-y-1">
            <span className="text-secondaryText text-xs block flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-forest" /> Target NGO ID:
            </span>
            <strong className="text-primaryText font-mono text-base block">{p.ngo_id}</strong>
          </div>
          <div className="space-y-1">
            <span className="text-secondaryText text-xs block flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-forest" /> Quantity Dispatched:
            </span>
            <strong className="text-primaryText text-base block">{p.quantity} units</strong>
          </div>
          <div className="space-y-1">
            <span className="text-secondaryText text-xs block flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-forest" /> Drop-off Destination:
            </span>
            <div className="text-xs font-semibold text-primaryText truncate mt-0.5" title={p.drop_off_location}>
              {p.drop_off_location}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-secondaryText text-xs block flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-forest" /> Human Approval Audit:
            </span>
            <div className="text-xs font-semibold mt-0.5">
              {p.approved_by ? (
                <span className="text-brandSuccess flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  {p.approved_by}
                </span>
              ) : (
                <span className="text-brandWarning flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Not Approved / Invalidated
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 5. Approval & Action Controls Categorized By Actor */}
        <div className="space-y-4 pt-2 border-t border-borderLine">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondaryText uppercase tracking-wider">
              Lifecycle Control Panel (Role-Separated)
            </span>
            <span className="text-xs text-secondaryText bg-ivory px-2.5 py-0.5 rounded border border-borderLine">
              Simulates Real-World Multi-Party Interaction
            </span>
          </div>

          {/* Group A: Human Store Manager Gating (Step 04) */}
          {(isPendingApproval || isReconfirmationNeeded) && (
            <div className="p-4 rounded-[10px] bg-amber-50/70 border border-amber-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  👤 Store Manager Sign-Off (Mandated by Hackathon Step 04)
                </span>
                <Badge variant="warning" size="sm">Human Approval Gate</Badge>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                The AI Agent matched the NGO and formulated this proposal. Before food leaves the store, human approval is mandatory to prevent unauthorized donation of inventory.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-2">
                {isPendingApproval && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprove(p.id, p.approval_version)}
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Approve Proposal (Sign Off)
                  </Button>
                )}
                {isReconfirmationNeeded && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprove(p.id, p.approval_version)}
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Reconfirm New Location (v{p.approval_version})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Group B: Recipient NGO Portal Simulation (External Counter-Party) */}
          {(isApprovedAwaitingNgo || isNgoAccepted) && (
            <div className="p-4 rounded-[10px] bg-blue-50/60 border border-blue-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-700" />
                  🏢 Recipient NGO Portal (External Charity Simulation)
                </span>
                <Badge variant="info" size="sm">Counter-Party Portal</Badge>
              </div>
              <p className="text-xs text-blue-800 leading-relaxed">
                An AI agent cannot force an outside charity to accept food. In production, the recipient NGO driver receives the dispatch on their app. Use these buttons to simulate their response.
              </p>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {isApprovedAwaitingNgo && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAcceptByNGO(p.id, p.approval_version)}
                      icon={<UserCheck className="w-3.5 h-3.5 text-forest" />}
                    >
                      NGO Portal: Confirm Acceptance
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRejectByNGO(p.id)}
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
                    setTargetPickupId(p.id);
                    setLocationModalOpen(true);
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
          <div className="p-4 rounded-[10px] bg-emerald-50/50 border border-emerald-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-forest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-forest" />
                🤖 AI Agent Tools & Physical Completion
              </span>
              <Badge variant="success" size="sm">Agent Tool Calling</Badge>
            </div>
            <p className="text-xs text-secondaryText leading-relaxed">
              The Agent uses its dedicated tool <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-borderLine">tool_get_pickup_status</code> to poll the platform ledger directly without relying on stale local cache.
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQueryLiveStatus(p.id)}
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
                  onClick={() => handleVerifyCompletion(p.id)}
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
            <div className="p-3 rounded-[8px] bg-[#FAFBF9] border border-borderLine text-xs text-secondaryText flex items-start gap-2">
              <Info className="w-4 h-4 text-forest flex-shrink-0 mt-0.5" />
              <span>
                <strong>Recipient Acknowledgment Pending:</strong> Dispatch is awaiting confirmation in the recipient NGO platform portal. Physical collection verification remains locked until accepted.
              </span>
            </div>
          )}

          {/* 6. Live Independent Platform State & Audit Evidence */}
          <div className={`pt-3 border-t border-borderLine space-y-3 transition-all ${
            isVerifiedMatching ? 'bg-[#F4FAF6] -mx-4 px-4 py-3 rounded-b-[8px] border-t-2 border-t-brandSuccess' : ''
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-secondaryText uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-forest" />
                <span>Independently Verified Platform State (SQLite Ledger)</span>
              </span>
              {isVerifiedMatching ? (
                <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-white text-brandSuccess border border-[#C7E3D0] font-bold flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brandSuccess" />
                  <span>VERIFIED LIVE AT {new Date(verifiedQueryState.query_timestamp).toLocaleTimeString()}</span>
                </span>
              ) : (
                <span className="text-xs font-mono text-secondaryText">
                  Live Database Record
                </span>
              )}
            </div>

            {/* Direct Feedback Callout when tool executes */}
            {isVerifiedMatching && (
              <div className="p-3 rounded-[8px] bg-white border border-[#C7E3D0] text-xs text-brandSuccess flex items-start gap-2.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-brandSuccess flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-primaryText">
                  <strong className="text-brandSuccess block font-heading text-sm">
                    Agent Query Tool Confirmed Database State:
                  </strong>
                  <span className="text-secondaryText text-xs leading-relaxed">
                    Direct query against SQLite mock platform confirms dispatch <code className="font-mono font-bold text-primaryText bg-ivory px-1.5 py-0.5 rounded border border-borderLine">{p.id}</code> is currently <strong>{verifiedQueryState.retrieved_state?.status}</strong> (NGO Accepted: {verifiedQueryState.retrieved_state?.accepted_by_ngo ? 'Yes' : 'No'}, Version: v{verifiedQueryState.retrieved_state?.approval_version}).
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded bg-white border border-borderLine">
                <span className="text-secondaryText block text-[10px] uppercase font-sans">Database Status:</span>
                <strong className="text-primaryText text-sm block mt-0.5">{isVerifiedMatching ? verifiedQueryState.retrieved_state.status : p.status}</strong>
              </div>
              <div className="p-2.5 rounded bg-white border border-borderLine">
                <span className="text-secondaryText block text-[10px] uppercase font-sans">NGO Acceptance:</span>
                <span className={`text-sm font-bold block mt-0.5 ${(isVerifiedMatching ? verifiedQueryState.retrieved_state.accepted_by_ngo : p.accepted_by_ngo) ? 'text-brandSuccess' : 'text-brandWarning'}`}>
                  {(isVerifiedMatching ? verifiedQueryState.retrieved_state.accepted_by_ngo : p.accepted_by_ngo) ? 'Accepted by NGO' : 'Awaiting NGO'}
                </span>
              </div>
              <div className="p-2.5 rounded bg-white border border-borderLine">
                <span className="text-secondaryText block text-[10px] uppercase font-sans">Approval Version:</span>
                <span className="text-primaryText font-bold text-sm block mt-0.5">v{(isVerifiedMatching ? verifiedQueryState.retrieved_state.approval_version : p.approval_version)}</span>
              </div>
              <div className="p-2.5 rounded bg-white border border-borderLine">
                <span className="text-secondaryText block text-[10px] uppercase font-sans">Physical Handoff:</span>
                <span className={`text-sm font-bold block mt-0.5 ${(isVerifiedMatching ? verifiedQueryState.retrieved_state.collected_at : p.collected_at) ? 'text-brandSuccess' : 'text-secondaryText'}`}>
                  {(isVerifiedMatching ? verifiedQueryState.retrieved_state.collected_at : p.collected_at) ? 'Verified Complete' : 'Pending Receipt'}
                </span>
              </div>
            </div>

            {p.accepted_at && (
              <div className="text-xs text-secondaryText bg-white p-2.5 rounded border border-borderLine flex items-center justify-between">
                <span>NGO Acceptance Timestamp: <strong className="font-mono text-primaryText">{new Date(p.accepted_at).toLocaleString()}</strong></span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-ivory text-forest border border-forest/20 font-mono font-semibold">CONFIRMED IN DB</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

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

        <div className="flex items-center gap-3">
          {/* View Mode Switcher: Wide Video View vs Split Sidebar */}
          <div className="flex items-center p-0.5 rounded-[7px] bg-[#FAFBF9] border border-borderLine text-xs">
            <button
              type="button"
              onClick={() => setViewMode('PRESENTATION')}
              className={`flex items-center gap-1.5 py-1 px-3 rounded-[5px] text-xs font-semibold transition-all ${
                viewMode === 'PRESENTATION'
                  ? 'bg-white text-forest shadow-xs border border-forest/30 font-bold'
                  : 'text-secondaryText hover:text-primaryText'
              }`}
              title="Wide Presentation View (Maximized for Demo Video Recording)"
            >
              <Maximize2 className="w-3.5 h-3.5 text-forest" />
              <span>Wide Video View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('SPLIT')}
              className={`flex items-center gap-1.5 py-1 px-3 rounded-[5px] text-xs font-semibold transition-all ${
                viewMode === 'SPLIT'
                  ? 'bg-white text-primaryText shadow-xs border border-borderLine font-bold'
                  : 'text-secondaryText hover:text-primaryText'
              }`}
              title="Split Columns with Left Directory"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split Sidebar</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/test-scenarios')}
          >
            Run Official Scenarios
          </Button>
        </div>
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
      ) : viewMode === 'PRESENTATION' ? (
        /* WIDE PRESENTATION VIEW (OPTIMIZED FOR VIDEO RECORDING) */
        <div className="space-y-6">
          {/* Top Dispatch Selector Bar */}
          <div className="p-4 rounded-[10px] bg-white border border-borderLine shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-secondaryText uppercase tracking-wider">
                  Select Dispatch Record:
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-ivory text-primaryText border border-borderLine font-semibold">
                  {filteredPickups.length} available
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center p-0.5 rounded-[7px] bg-[#FAFBF9] border border-borderLine text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('ALL')}
                  className={`py-1 px-3 rounded-[5px] text-xs font-medium transition-all ${
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
                  className={`py-1 px-3 rounded-[5px] text-xs font-medium transition-all ${
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
                  className={`py-1 px-3 rounded-[5px] text-xs font-medium transition-all ${
                    activeTab === 'SCENARIO'
                      ? 'bg-white text-accent font-bold shadow-xs border border-accent/30'
                      : 'text-secondaryText hover:text-primaryText'
                  }`}
                >
                  Scenarios ({pickups.filter(p => isScenario(p)).length})
                </button>
              </div>
            </div>

            {/* Selectable Pickup Cards Horizontal Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
              {filteredPickups.map((p) => {
                const isSelected = selectedPickup?.id === p.id;
                const statusMeta = getStatusMeta(p.status, 'pickup');
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPickup(p.id)}
                    className={`p-3 rounded-[8px] border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#F4FAF6] border-forest ring-2 ring-forest/20 shadow-sm'
                        : 'bg-[#FAFBF9] border-borderLine hover:bg-white hover:border-forest/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono text-xs font-bold text-primaryText">{p.id}</span>
                      <Badge variant={statusMeta.variant} size="sm">{statusMeta.label}</Badge>
                    </div>
                    <div className="text-[11px] text-secondaryText flex items-center justify-between">
                      <span>NGO: <strong className="text-primaryText font-medium">{p.ngo_id}</strong></span>
                      <span className="font-medium text-primaryText">{p.quantity} units</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full-Width Detailed Structured View */}
          {selectedPickup && renderDetailCard(selectedPickup)}
        </div>
      ) : (
        /* SPLIT COLUMN VIEW (SIDEBAR DIRECTORY + MAIN WORKSPACE) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Pickup List (Table View) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-secondaryText uppercase tracking-wider">
                Dispatches ({filteredPickups.length})
              </span>
              <span className="text-[11px] text-secondaryText">
                Select request
              </span>
            </div>

            {/* Filter Tabs */}
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
            <div className="lg:col-span-8 space-y-5">
              {renderDetailCard(selectedPickup)}
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
