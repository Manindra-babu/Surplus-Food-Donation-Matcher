import React, { useEffect, useState } from 'react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { api } from '../services/api';
import { DashboardMetrics, Donation, PickupRequest, AgentRun } from '../types';
import { getStatusMeta } from '../utils/status';
import { formatISTShortTime } from '../utils/time';
import {
  UtensilsCrossed,
  UserCheck,
  CheckCircle2,
  Truck,
  PlusCircle,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  MapPin,
  Clock,
  Activity,
  ExternalLink,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (route: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [m, d, p, runs] = await Promise.all([
        api.getMetrics(),
        api.getDonations(),
        api.getPickups(),
        api.getAgentRuns()
      ]);
      setMetrics(m);
      setDonations(d);
      setPickups(p);
      setAgentRuns(runs.slice(0, 5));
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const [queueFilter, setQueueFilter] = useState<'ALL' | 'OPERATIONAL' | 'SCENARIOS'>('ALL');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isResettingDemo, setIsResettingDemo] = useState(false);

  const handleResetSandbox = async () => {
    if (!window.confirm("Reset sandbox demo database to clean seed records? This will clear test scenario artifacts.")) return;
    setIsResettingDemo(true);
    try {
      await api.resetDemo();
      await loadData();
    } catch (err: any) {
      setError("Failed to reset demo: " + err.message);
    } finally {
      setIsResettingDemo(false);
    }
  };

  // Compute 4 compact metrics from actual database records
  const activeDonationsCount = donations.filter(
    (d) => d.status !== 'COMPLETED' && d.status !== 'REJECTED_SAFETY'
  ).length;

  // Build prioritized Attention Queue items
  interface RawAttentionItem {
    id: string;
    type: 'APPROVAL_PENDING' | 'RECONFIRMATION_REQUIRED' | 'SAFETY_BLOCKED';
    title: string;
    referenceId: string;
    detail: string;
    actionLabel: string;
    isScenarioArtifact: boolean;
    scenarioTag?: string;
    created_at?: string;
    onAction: () => void;
  }

  const rawAttentionItems: RawAttentionItem[] = [];

  pickups.forEach((p) => {
    const isScenario = p.id.startsWith('REQ-TC') || p.donation_id.startsWith('DON-TC');
    const scenarioTag = p.id.startsWith('REQ-TC4') ? 'TC4' : p.id.startsWith('REQ-TC3') ? 'TC3' : p.id.startsWith('REQ-TC1') ? 'TC1' : undefined;

    if (p.status === 'PROPOSED' || p.status === 'PENDING_APPROVAL') {
      rawAttentionItems.push({
        id: `att-app-${p.id}`,
        type: 'APPROVAL_PENDING',
        title: 'Pickup Proposal Awaiting Operator Approval',
        referenceId: p.id,
        detail: `Donation ${p.donation_id} matched with NGO ${p.ngo_id} (${p.quantity} units). Operator sign-off is mandatory.`,
        actionLabel: 'Review & Sign Off',
        isScenarioArtifact: isScenario,
        scenarioTag,
        created_at: p.created_at,
        onAction: () => onNavigate(`/pickups?id=${p.id}`)
      });
    } else if (p.status === 'RECONFIRMATION_REQUIRED' || p.status === 'LOCATION_CHANGED') {
      rawAttentionItems.push({
        id: `att-loc-${p.id}`,
        type: 'RECONFIRMATION_REQUIRED',
        title: 'Drop-off Location Altered — Reconfirmation Mandated',
        referenceId: p.id,
        detail: `Destination changed to "${p.drop_off_location}". Prior approval invalidated (v${p.approval_version}).`,
        actionLabel: 'Reconfirm Location',
        isScenarioArtifact: isScenario,
        scenarioTag,
        created_at: p.created_at,
        onAction: () => onNavigate(`/pickups?id=${p.id}`)
      });
    }
  });

  donations.forEach((d) => {
    const isScenario = d.id.startsWith('DON-TC');
    const scenarioTag = d.id.startsWith('DON-TC2') ? 'TC2' : undefined;

    if (d.status === 'REJECTED_SAFETY') {
      rawAttentionItems.push({
        id: `att-safe-${d.id}`,
        type: 'SAFETY_BLOCKED',
        title: 'Food Safety Holding Limit Exceeded',
        referenceId: d.id,
        detail: `"${d.food_name}" prepared at ${formatISTShortTime(d.prepared_at)} violates FDA Food Code §3-501.19 limits. Dispatch blocked.`,
        actionLabel: 'Inspect Evidence',
        isScenarioArtifact: isScenario,
        scenarioTag,
        created_at: d.created_at,
        onAction: () => onNavigate(`/donations?id=${d.id}`)
      });
    }
  });

  // Grouping logic for repeated test scenario artifacts (TC4 and TC2)
  interface GroupedAttentionItem {
    id: string;
    type: 'APPROVAL_PENDING' | 'RECONFIRMATION_REQUIRED' | 'SAFETY_BLOCKED';
    title: string;
    referenceId: string;
    detail: string;
    actionLabel: string;
    isScenarioArtifact: boolean;
    scenarioTag?: string;
    onAction: () => void;
    groupCount?: number;
    subItems?: RawAttentionItem[];
  }

  const groupedAttentionItems: GroupedAttentionItem[] = [];

  // 1. Separate Operational items vs Scenario items
  const operationalItems = rawAttentionItems.filter(i => !i.isScenarioArtifact);
  const scenarioItems = rawAttentionItems.filter(i => i.isScenarioArtifact);

  // Always show operational items directly
  operationalItems.forEach(item => groupedAttentionItems.push(item));

  // Group scenario TC4 items if multiple exist
  const tc4Items = scenarioItems.filter(i => i.scenarioTag === 'TC4');
  if (tc4Items.length > 1) {
    const latest = tc4Items[0];
    groupedAttentionItems.push({
      id: 'group-tc4-reconfirm',
      type: 'RECONFIRMATION_REQUIRED',
      title: `Drop-off Location Alterations (TC4 Test Scenario) — ${tc4Items.length} records recorded`,
      referenceId: `${tc4Items.length} runs`,
      detail: `Recipient NGO destination changes from automated scenario runs. Latest: "${latest.detail.split('"')[1] || 'Altered Depot'}". Individual records and audit trails preserved.`,
      actionLabel: 'Inspect Latest Run',
      isScenarioArtifact: true,
      scenarioTag: 'TC4',
      onAction: latest.onAction,
      groupCount: tc4Items.length,
      subItems: tc4Items
    });
  } else if (tc4Items.length === 1) {
    groupedAttentionItems.push(tc4Items[0]);
  }

  // Group scenario TC2 items if multiple exist
  const tc2Items = scenarioItems.filter(i => i.scenarioTag === 'TC2');
  if (tc2Items.length > 1) {
    const latest = tc2Items[0];
    groupedAttentionItems.push({
      id: 'group-tc2-safety',
      type: 'SAFETY_BLOCKED',
      title: `Food Safety Holding Violations (TC2 Test Scenario) — ${tc2Items.length} records recorded`,
      referenceId: `${tc2Items.length} runs`,
      detail: `Mandatory discards under FDA Food Code §3-501.19 from automated scenario runs. Dispatch blocked on all runs.`,
      actionLabel: 'Inspect Latest Run',
      isScenarioArtifact: true,
      scenarioTag: 'TC2',
      onAction: latest.onAction,
      groupCount: tc2Items.length,
      subItems: tc2Items
    });
  } else if (tc2Items.length === 1) {
    groupedAttentionItems.push(tc2Items[0]);
  }

  // Any other scenario items
  scenarioItems.filter(i => i.scenarioTag !== 'TC4' && i.scenarioTag !== 'TC2').forEach(item => {
    groupedAttentionItems.push(item);
  });

  // Filter based on selected queue tab
  const displayedAttentionItems = groupedAttentionItems.filter(item => {
    if (queueFilter === 'OPERATIONAL') return !item.isScenarioArtifact;
    if (queueFilter === 'SCENARIOS') return item.isScenarioArtifact;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-[8px] bg-[#FBEBEA] border border-[#F2C2BF] text-brandError text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* A. Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-borderLine">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-primaryText tracking-tight">
            Operations overview
          </h2>
          <p className="text-xs text-secondaryText">
            Continuous food-rescue logistics computed from real-time platform database records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/test-scenarios')}
            icon={<CheckCircle2 className="w-3.5 h-3.5 text-forest" />}
          >
            Official Test Scenarios
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('/donations/new')}
            icon={<PlusCircle className="w-3.5 h-3.5" />}
          >
            New Donation
          </Button>
        </div>
      </div>

      {/* B. Compact Operational Summary (Strictly 4 database-derived metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Active Donations */}
        <Card padding="sm" className="space-y-1">
          <div className="flex items-center justify-between text-secondaryText">
            <span className="text-xs font-medium">Active donations</span>
            <UtensilsCrossed className="w-4 h-4 text-forest" />
          </div>
          <div className="text-2xl font-bold font-heading text-primaryText">
            {isLoading ? '—' : activeDonationsCount}
          </div>
          <div className="text-[11px] text-secondaryText truncate">
            Intake awaiting completion
          </div>
        </Card>

        {/* Metric 2: Awaiting Approval */}
        <Card padding="sm" className={`space-y-1 ${metrics && metrics.pending_approval > 0 ? 'border-accent/40 bg-[#FDFBF7]' : ''}`}>
          <div className="flex items-center justify-between text-secondaryText">
            <span className="text-xs font-medium">Awaiting approval</span>
            <UserCheck className={`w-4 h-4 ${metrics && metrics.pending_approval > 0 ? 'text-accent' : 'text-secondaryText'}`} />
          </div>
          <div className={`text-2xl font-bold font-heading ${metrics && metrics.pending_approval > 0 ? 'text-accent' : 'text-primaryText'}`}>
            {isLoading ? '—' : (metrics?.pending_approval ?? 0)}
          </div>
          <div className="text-[11px] text-secondaryText truncate">
            Mandatory operator sign-off
          </div>
        </Card>

        {/* Metric 3: Awaiting NGO Acceptance */}
        <Card padding="sm" className="space-y-1">
          <div className="flex items-center justify-between text-secondaryText">
            <span className="text-xs font-medium">Awaiting NGO acceptance</span>
            <Truck className="w-4 h-4 text-secondaryText" />
          </div>
          <div className="text-2xl font-bold font-heading text-primaryText">
            {isLoading ? '—' : (metrics?.pending_ngo_acceptance ?? 0)}
          </div>
          <div className="text-[11px] text-secondaryText truncate">
            Pending partner dispatch
          </div>
        </Card>

        {/* Metric 4: Verified Completion */}
        <Card padding="sm" className="space-y-1">
          <div className="flex items-center justify-between text-secondaryText">
            <span className="text-xs font-medium">Verified completion</span>
            <CheckCircle2 className="w-4 h-4 text-brandSuccess" />
          </div>
          <div className="text-2xl font-bold font-heading text-brandSuccess">
            {isLoading ? '—' : (metrics?.collected_or_verified ?? 0)}
          </div>
          <div className="text-[11px] text-secondaryText truncate">
            Independent status confirmed
          </div>
        </Card>
      </div>

      {/* C. Attention Queue */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-heading text-primaryText uppercase tracking-wider">
              Attention Queue
            </span>
            {displayedAttentionItems.length > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#FDF3E7] text-brandWarning border border-[#F2D7B3]">
                {displayedAttentionItems.length} {displayedAttentionItems.length === 1 ? 'Item' : 'Items'}
              </span>
            )}
          </div>

          {/* Queue Filter Tabs & Sandbox Reset */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center p-0.5 rounded-[6px] bg-white border border-borderLine text-[11px]">
              <button
                type="button"
                onClick={() => setQueueFilter('ALL')}
                className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors cursor-pointer ${
                  queueFilter === 'ALL' ? 'bg-forest text-white' : 'text-secondaryText hover:text-primaryText'
                }`}
              >
                All ({groupedAttentionItems.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueFilter('OPERATIONAL')}
                className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors cursor-pointer ${
                  queueFilter === 'OPERATIONAL' ? 'bg-forest text-white' : 'text-secondaryText hover:text-primaryText'
                }`}
              >
                Live Ops ({operationalItems.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueFilter('SCENARIOS')}
                className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors cursor-pointer ${
                  queueFilter === 'SCENARIOS' ? 'bg-forest text-white' : 'text-secondaryText hover:text-primaryText'
                }`}
              >
                Test Runs ({scenarioItems.length})
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSandbox}
              isLoading={isResettingDemo}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              title="Reset sandbox demo database to clean initial state"
            >
              Reset Sandbox
            </Button>
          </div>
        </div>

        {displayedAttentionItems.length === 0 ? (
          <Card padding="sm" className="bg-[#FAFBF9] border-borderLine">
            <div className="flex items-center gap-3 py-1">
              <CheckCircle2 className="w-4 h-4 text-brandSuccess flex-shrink-0" />
              <div className="text-xs text-secondaryText">
                <strong className="text-primaryText font-medium">Attention queue clear.</strong> No pending operational actions match the selected filter.
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {displayedAttentionItems.map((item) => {
              const isDanger = item.type === 'RECONFIRMATION_REQUIRED' || item.type === 'SAFETY_BLOCKED';
              const isExpanded = !!expandedGroups[item.id];

              return (
                <div
                  key={item.id}
                  className={`rounded-[8px] border transition-colors overflow-hidden ${
                    isDanger
                      ? 'bg-[#FFFBFB] border-[#F2C2BF]'
                      : 'bg-[#FDFBF7] border-[#F2D7B3]'
                  }`}
                >
                  <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 flex-shrink-0">
                        {item.type === 'APPROVAL_PENDING' && (
                          <UserCheck className="w-4 h-4 text-accent" />
                        )}
                        {item.type === 'RECONFIRMATION_REQUIRED' && (
                          <MapPin className="w-4 h-4 text-brandError" />
                        )}
                        {item.type === 'SAFETY_BLOCKED' && (
                          <ShieldAlert className="w-4 h-4 text-brandError" />
                        )}
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-primaryText">
                            {item.title}
                          </span>
                          <span className="font-mono text-[11px] text-secondaryText px-1.5 py-0.2 rounded bg-white border border-borderLine">
                            {item.referenceId}
                          </span>
                          {item.isScenarioArtifact && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-ivory text-forest border border-forest/20">
                              TEST SCENARIO ARTIFACT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-secondaryText leading-relaxed">
                          {item.detail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 sm:self-center">
                      {item.subItems && item.subItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setExpandedGroups(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                          className="px-2.5 py-1 text-xs text-forest hover:text-forest-dark font-medium flex items-center gap-1 cursor-pointer bg-white rounded-[6px] border border-borderLine"
                        >
                          <Layers className="w-3 h-3" />
                          <span>{isExpanded ? 'Collapse' : `View All ${item.subItems.length}`}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}

                      <Button
                        variant={isDanger ? 'danger' : 'primary'}
                        size="sm"
                        onClick={item.onAction}
                      >
                        {item.actionLabel}
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Individual Sub-Items (Preserving Complete History) */}
                  {item.subItems && isExpanded && (
                    <div className="bg-white/80 border-t border-borderLine p-3 space-y-2">
                      <div className="text-[11px] font-semibold text-secondaryText uppercase tracking-wider">
                        All {item.subItems.length} Recorded Test Events (Audit Trail Preserved):
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {item.subItems.map(sub => (
                          <div
                            key={sub.id}
                            className="p-2 rounded-[6px] bg-[#FAFBF9] border border-borderLine flex items-center justify-between text-xs gap-3"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[11px] font-semibold text-primaryText">
                                {sub.referenceId}
                              </span>
                              <span className="text-[11px] text-secondaryText truncate">
                                {sub.detail}
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={sub.onAction}
                              className="text-[11px] py-0.5 px-2 flex-shrink-0"
                            >
                              Inspect
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* D. Recent Pickup Requests (Structured Table) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-sm text-primaryText">
              Recent Pickup Requests
            </h3>
            <p className="text-xs text-secondaryText">
              Dispatches evaluated, approved, and verified through the execution state machine.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/pickups')}
            className="text-xs text-forest hover:text-forest-dark font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({pickups.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <Card padding="none" className="overflow-hidden">
          {pickups.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Truck className="w-8 h-8 text-secondaryText/40 mx-auto" />
              <p className="text-sm font-medium text-primaryText">No pickup requests recorded</p>
              <p className="text-xs text-secondaryText">
                Match a surplus donation or run the official test scenarios to populate active requests.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('/matching')}
                className="mt-2"
              >
                Go to NGO Matching
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F7F9F6] border-b border-borderLine text-secondaryText font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-4">Request ID</th>
                    <th className="py-2.5 px-4">Donation</th>
                    <th className="py-2.5 px-4">Quantity</th>
                    <th className="py-2.5 px-4">NGO</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {pickups.slice(0, 6).map((pickup) => {
                    const statusMeta = getStatusMeta(pickup.status, 'pickup');

                    return (
                      <tr key={pickup.id} className="hover:bg-ivory/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-primaryText whitespace-nowrap">
                          {pickup.id}
                        </td>

                        <td className="py-3 px-4 font-mono text-secondaryText whitespace-nowrap">
                          {pickup.donation_id}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-medium text-primaryText">{pickup.quantity}</span>{' '}
                          <span className="text-secondaryText text-[11px]">units</span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-primaryText truncate max-w-[180px]">
                            {pickup.ngo_id}
                          </div>
                          <div className="text-[11px] text-secondaryText truncate max-w-[200px]" title={pickup.drop_off_location}>
                            {pickup.drop_off_location} (v{pickup.approval_version})
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge variant={statusMeta.variant} size="sm">
                            {statusMeta.label}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Button
                            variant={
                              pickup.status === 'PROPOSED' || pickup.status === 'RECONFIRMATION_REQUIRED'
                                ? 'primary'
                                : 'outline'
                            }
                            size="sm"
                            onClick={() => onNavigate('/pickups')}
                          >
                            {pickup.status === 'PROPOSED'
                              ? 'Approve'
                              : pickup.status === 'RECONFIRMATION_REQUIRED'
                              ? 'Reconfirm'
                              : 'Inspect'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* E. Secondary Information: Recent Agent Coordination Ledger */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-sm text-primaryText flex items-center gap-2">
              <Activity className="w-4 h-4 text-forest" />
              <span>Recent Coordination Agent Activity</span>
            </h3>
            <p className="text-xs text-secondaryText">
              Evidence traces recorded from automated constraint checks and LLM synthesis.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/agent-runs')}
            className="text-xs text-forest hover:text-forest-dark font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>View Full Ledger</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <Card padding="none" className="overflow-hidden">
          {agentRuns.length === 0 ? (
            <div className="p-6 text-center text-xs text-secondaryText">
              No recent agent executions recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F7F9F6] border-b border-borderLine text-secondaryText font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-4">Execution ID</th>
                    <th className="py-2.5 px-4">Scope</th>
                    <th className="py-2.5 px-4">Stage</th>
                    <th className="py-2.5 px-4">Outcome</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4 text-right">Trace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {agentRuns.map((r) => {
                    const statusMeta = getStatusMeta(r.status, 'run');

                    return (
                      <tr key={r.id} className="hover:bg-ivory/30 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-medium text-primaryText">
                          {r.id}
                        </td>
                        <td className="py-2.5 px-4 text-secondaryText font-medium">
                          {r.scenario_id || r.donation_id || 'Interactive'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-secondaryText">
                          {r.current_stage}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant={statusMeta.variant} size="sm">
                            {statusMeta.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-secondaryText font-mono text-[11px]">
                          {formatISTShortTime(r.started_at)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onNavigate(`/agent-runs/${r.id}`)}
                            className="text-xs text-forest hover:text-forest-dark font-medium cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
