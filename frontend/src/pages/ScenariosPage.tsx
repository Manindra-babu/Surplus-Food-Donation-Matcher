import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { ScenarioRunResult } from '../types';
import { formatISTTime } from '../utils/time';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Check
} from 'lucide-react';

interface ScenariosPageProps {
  onNavigate: (route: string) => void;
}

interface ScenarioDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  expectedSummary: string;
  expectedPoints: string[];
}

export const ScenariosPage: React.FC<ScenariosPageProps> = ({ onNavigate }) => {
  const [results, setResults] = useState<Record<string, ScenarioRunResult>>({});
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [lastExecutedAt, setLastExecutedAt] = useState<string | null>(null);
  const [lastExecutionType, setLastExecutionType] = useState<'SUITE' | 'SINGLE' | null>(null);
  const [lastRunScenarioId, setLastRunScenarioId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedJson, setExpandedJson] = useState<Record<string, boolean>>({});

  const scenarios: ScenarioDefinition[] = [
    {
      id: 'TC1',
      name: 'TC1: Fresh Food with NGO Capacity',
      category: 'End-to-End Coordination & Status Verification',
      description: 'Hot prepared food (62°C) prepared 45 minutes ago. Target NGO has verified capacity and service radius. Verifies algorithmic matching, human sign-off gating, idempotency key generation, and independent database status confirmation.',
      expectedSummary: 'Identifies top-ranked NGO, creates proposal in PROPOSED state, mandates explicit operator approval, and verifies database status transitions to APPROVED.',
      expectedPoints: [
        'Deterministic safety check: 45 min elapsed < 240 min limit (FDA Food Code §3-501.19)',
        'City Hope Food Rescue matched with score ≥ 80 based on capacity, distance, and diet',
        'Proposal held in PROPOSED status; no dispatch occurs without human approval',
        'Approval confirmed with operator signature; resulting platform status verified independently'
      ]
    },
    {
      id: 'TC2',
      name: 'TC2: Food Prepared Too Long Ago',
      category: 'Food Safety Policy Engine Hard Rejection',
      description: 'Steam table pasta holding at ambient room temperature, prepared 330 minutes ago (> 240 min / 4-hour statutory limit). Verifies deterministic rules engine blocks dispatch and cannot be overridden by AI.',
      expectedSummary: 'Deterministic food safety rejection (REJECTED_FOOD_SAFETY_EXPIRED). Zero pickup requests generated. Citations logged in evidence trail.',
      expectedPoints: [
        'Time elapsed (330 min) exceeds maximum permitted threshold (240 min)',
        'Status immediately marked REJECTED_FOOD_SAFETY_EXPIRED',
        'Strict policy citations recorded: FDA Food Code §3-501.19 & Codex CAC/RCP 39-1993',
        'Zero pickup requests or dispatches created; LLM override strictly prohibited'
      ]
    },
    {
      id: 'TC3',
      name: 'TC3: NGO Has Not Accepted',
      category: 'Execution State Machine & Premature Collection Guard',
      description: 'Pickup proposal has been approved by the restaurant operator, but the recipient NGO has not yet confirmed acceptance. Verifies the request remains held and any premature collection attempt is actively rejected.',
      expectedSummary: 'Request status remains APPROVED (awaiting NGO acceptance). Premature attempt to mark collected is actively blocked by backend guards.',
      expectedPoints: [
        'Status remains strictly APPROVED with accepted_by_ngo = false',
        'Direct call to mark donation as collected triggers exception: "Cannot collect: NGO has not accepted"',
        'Platform prevents false reporting of rescue completion before actual NGO physical receipt'
      ]
    },
    {
      id: 'TC4',
      name: 'TC4: NGO Changes Drop-off Location',
      category: 'Location Alteration Protocol & Approval Invalidation',
      description: 'Recipient NGO alters the destination drop-off facility post-approval. Verifies the platform immediately invalidates the previous human approval, increments the proposal version, and mandates reconfirmation.',
      expectedSummary: 'Previous approval invalidated (approved_by = None). Proposal version increments from 1 to 2. Status set to RECONFIRMATION_REQUIRED.',
      expectedPoints: [
        'Drop-off facility changed from default depot to alternate location',
        'Previous operator approval invalidated immediately (approved_by cleared)',
        'Proposal version incremented to v2',
        'Status transitions to RECONFIRMATION_REQUIRED; restaurant re-approval mandated'
      ]
    }
  ];

  const handleRunSingle = async (scenarioId: string) => {
    setRunningScenario(scenarioId);
    setError(null);
    try {
      const res = await api.runScenario(scenarioId);
      setResults((prev) => ({ ...prev, [scenarioId]: res }));
      setLastExecutedAt(new Date().toISOString());
      setLastExecutionType('SINGLE');
      setLastRunScenarioId(scenarioId);
    } catch (err: any) {
      setError(`Failed to execute ${scenarioId}: ${err.message}`);
    } finally {
      setRunningScenario(null);
    }
  };

  const handleRunAll = async () => {
    setIsRunningAll(true);
    setError(null);
    try {
      const allResults = await api.runAllScenarios();
      const mapped: Record<string, ScenarioRunResult> = {};
      allResults.forEach((r) => {
        mapped[r.scenario_id] = r;
      });
      setResults(mapped);
      setLastExecutedAt(new Date().toISOString());
      setLastExecutionType('SUITE');
      setLastRunScenarioId(null);
    } catch (err: any) {
      setError(`Failed to run scenario suite: ${err.message}`);
    } finally {
      setIsRunningAll(false);
    }
  };

  const toggleJson = (id: string) => {
    setExpandedJson((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Derive counts
  const totalScenarios = scenarios.length;
  const passedCount = scenarios.filter((s) => results[s.id]?.passed === true).length;
  const failedCount = scenarios.filter((s) => results[s.id] && results[s.id]?.passed === false).length;
  const pendingCount = totalScenarios - (passedCount + failedCount);

  // Generate plain English explanation of scenario results
  const getPlainEnglishResult = (scenarioId: string, res: ScenarioRunResult) => {
    if (!res.passed) {
      return `Verification failed: The platform outcome did not match expected criteria for ${scenarioId}.`;
    }

    switch (scenarioId) {
      case 'TC1':
        return 'Food safety passed (45 min elapsed < 240 min limit). City Hope Food Rescue matched with top multi-factor score. Proposal was held in PROPOSED status, explicit operator sign-off confirmed, and platform database independently verified in APPROVED state.';
      case 'TC2':
        return 'Time-as-a-Public-Health-Control policy enforced. Prepared food elapsed duration (330 min) exceeded the 240-minute limit. System issued a deterministic rejection citing FDA Food Code §3-501.19. Zero pickup dispatches were created.';
      case 'TC3':
        return 'Premature collection actively guarded. The proposal remained in APPROVED status awaiting partner confirmation (accepted_by_ngo=false). Attempt to mark the donation as collected was intercepted and blocked by backend validation rules.';
      case 'TC4':
        return 'Approval invalidation protocol verified. Following NGO modification of the drop-off facility, prior operator approval was invalidated (approved_by=None), proposal version incremented to 2, and status transitioned to RECONFIRMATION_REQUIRED.';
      default:
        return 'Scenario executed and verified successfully against database state.';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Heading & Suite Execution Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-borderLine">
        <div>
          <h2 className="text-xl font-bold font-heading text-primaryText tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-forest" />
            <span>Official Test Scenarios</span>
          </h2>
          <p className="text-xs text-secondaryText">
            Executable compliance suite with input snapshots, expected vs verified platform state, and evidence ledger.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            onClick={handleRunAll}
            isLoading={isRunningAll}
            disabled={runningScenario !== null}
            icon={<Play className="w-3.5 h-3.5" />}
          >
            Run All 4 Scenarios
          </Button>
        </div>
      </div>

      {/* Test Suite Completion State Banner */}
      <Card padding="md" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-borderLine">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-secondaryText uppercase tracking-wider">
                Suite Execution State:
              </span>
              {isRunningAll ? (
                <Badge variant="warning" icon={<RotateCw className="w-3 h-3 animate-spin" />}>
                  Executing Suite (TC1 – TC4)...
                </Badge>
              ) : lastExecutionType === 'SUITE' ? (
                passedCount === totalScenarios ? (
                  <Badge variant="success" icon={<Check className="w-3 h-3" />}>
                    All 4 Scenarios Passed
                  </Badge>
                ) : (
                  <Badge variant="danger" icon={<XCircle className="w-3 h-3" />}>
                    {passedCount} Passed, {failedCount} Failed
                  </Badge>
                )
              ) : lastExecutionType === 'SINGLE' ? (
                <Badge variant="info">
                  Single Scenario Run ({lastRunScenarioId})
                </Badge>
              ) : (
                <Badge variant="neutral">
                  Ready to Run
                </Badge>
              )}
            </div>

            <p className="text-xs text-secondaryText mt-1">
              {isRunningAll
                ? 'Running automated verification across all 4 scenarios in sequence.'
                : lastExecutionType === 'SUITE'
                ? 'All four official test cases executed against the live platform state machine.'
                : lastExecutionType === 'SINGLE'
                ? `Executed single scenario ${lastRunScenarioId}. Run complete suite to update all four states simultaneously.`
                : 'Execute the entire test suite or run individual scenarios to generate verifiable audit evidence.'}
            </p>
          </div>

          {lastExecutedAt && (
            <div className="text-xs text-secondaryText sm:text-right font-mono flex items-center gap-1.5 sm:block">
              <Clock className="w-3.5 h-3.5 text-forest inline sm:mr-1" />
              <span>Last Run: {formatISTTime(lastExecutedAt)}</span>
            </div>
          )}
        </div>

        {/* 3 Status Counters: Passed, Failed, Pending */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2.5 rounded-[6px] bg-[#EBF5EE] border border-[#C7E3D0]">
            <span className="text-xl font-bold font-heading text-brandSuccess block">
              {passedCount}
            </span>
            <span className="text-[11px] font-medium text-brandSuccess">
              Passed
            </span>
          </div>

          <div className="p-2.5 rounded-[6px] bg-[#FBEBEA] border border-[#F2C2BF]">
            <span className="text-xl font-bold font-heading text-brandError block">
              {failedCount}
            </span>
            <span className="text-[11px] font-medium text-brandError">
              Failed
            </span>
          </div>

          <div className="p-2.5 rounded-[6px] bg-[#F7F9F6] border border-borderLine">
            <span className="text-xl font-bold font-heading text-secondaryText block">
              {pendingCount}
            </span>
            <span className="text-[11px] font-medium text-secondaryText">
              Pending
            </span>
          </div>
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="p-3.5 rounded-[8px] bg-[#FBEBEA] border border-[#F2C2BF] text-brandError text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Official Scenarios */}
      <div className="space-y-5">
        {scenarios.map((sc) => {
          const res = results[sc.id];
          const isRunningThis = runningScenario === sc.id || isRunningAll;
          const isExpanded = !!expandedJson[sc.id];

          return (
            <Card key={sc.id} padding="md" className="space-y-4">
              {/* Scenario Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-borderLine">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-[4px] bg-sage text-forest-dark border border-forest/15">
                      {sc.id}
                    </span>
                    <h3 className="font-heading font-bold text-base text-primaryText">
                      {sc.name}
                    </h3>
                  </div>
                  <span className="text-[11px] text-forest font-semibold block">
                    {sc.category}
                  </span>
                  <p className="text-xs text-secondaryText leading-relaxed">
                    {sc.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1 sm:pt-0 flex-shrink-0">
                  {res ? (
                    <Badge variant={res.passed ? 'success' : 'danger'}>
                      {res.passed ? 'Passed — Verified' : 'Failed'}
                    </Badge>
                  ) : (
                    <Badge variant="neutral">
                      Pending Run
                    </Badge>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRunSingle(sc.id)}
                    isLoading={isRunningThis}
                    disabled={isRunningAll}
                    icon={<Play className="w-3 h-3 text-forest" />}
                  >
                    Run {sc.id}
                  </Button>
                </div>
              </div>

              {/* Verified Execution Result */}
              {res ? (
                <div className="space-y-4 pt-1">
                  {/* 1. Plain English Result First */}
                  <div className={`p-3.5 rounded-[8px] border text-xs leading-relaxed ${
                    res.passed
                      ? 'bg-[#EBF5EE]/70 border-[#C7E3D0] text-primaryText'
                      : 'bg-[#FBEBEA]/70 border-[#F2C2BF] text-brandError'
                  }`}>
                    <div className="flex items-start gap-2">
                      {res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-brandSuccess flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-brandError flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <strong className="block font-semibold mb-0.5">
                          {res.passed ? 'Verified Outcome:' : 'Verification Failed:'}
                        </strong>
                        <p>{getPlainEnglishResult(sc.id, res)}</p>
                      </div>
                    </div>
                  </div>

                  {/* 2. Structured Comparison: Expected vs Actual Verified Result */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Expected Outcome Column */}
                    <div className="p-3.5 rounded-[8px] bg-ivory border border-borderLine space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primaryText pb-1 border-b border-borderLine/70">
                        <Eye className="w-3.5 h-3.5 text-forest" />
                        <span>Expected Outcome</span>
                      </div>
                      <p className="text-xs text-secondaryText leading-relaxed">
                        {sc.expectedSummary}
                      </p>
                      <ul className="text-[11px] text-secondaryText space-y-1 list-disc pl-4 pt-1">
                        {sc.expectedPoints.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Actual Verified Outcome Column */}
                    <div className="p-3.5 rounded-[8px] bg-[#FAFBF9] border border-borderLine space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primaryText pb-1 border-b border-borderLine/70">
                        <ShieldCheck className="w-3.5 h-3.5 text-brandSuccess" />
                        <span>Actual Platform Verification (Independent Query)</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {Object.entries(res.actual_result || {}).map(([key, val]) => (
                          <div key={key} className="flex items-start justify-between gap-2 text-[11px] border-b border-borderLine/50 pb-1">
                            <span className="text-secondaryText font-mono">{key}:</span>
                            <span className="font-semibold text-primaryText text-right font-mono truncate max-w-[240px]">
                              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 3. Evidence Meta Bar with Trace Link */}
                  <div className="p-3 rounded-[7px] bg-[#F7F9F6] border border-borderLine flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-forest flex-shrink-0" />
                      <span className="text-secondaryText">
                        Evidence Recorded: <strong className="font-mono text-primaryText">{res.agent_run_id}</strong> • Completed: {formatISTTime(res.completed_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleJson(sc.id)}
                        className="text-xs text-secondaryText hover:text-primaryText font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isExpanded ? 'Hide Raw JSON Trace' : 'View Raw JSON Trace'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => onNavigate(`/agent-runs/${res.agent_run_id}`)}
                        className="text-xs text-forest hover:text-forest-dark font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <span>Inspect Run Ledger</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* 4. Collapsible Technical Trace JSON (Never overwhelms page by default) */}
                  {isExpanded && (
                    <div className="pt-2 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                        <div>
                          <span className="text-secondaryText text-[10px] font-semibold uppercase tracking-wider block mb-1">
                            Expected Result Payload
                          </span>
                          <pre className="p-2.5 rounded-[5px] bg-white border border-borderLine text-secondaryText overflow-x-auto max-h-48 leading-relaxed">
                            {JSON.stringify(res.expected_result, null, 2)}
                          </pre>
                        </div>

                        <div>
                          <span className="text-secondaryText text-[10px] font-semibold uppercase tracking-wider block mb-1">
                            Actual Verified Payload
                          </span>
                          <pre className="p-2.5 rounded-[5px] bg-white border border-borderLine text-primaryText overflow-x-auto max-h-48 leading-relaxed">
                            {JSON.stringify(res.actual_result, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-secondaryText bg-ivory/60 p-3 rounded-[6px] border border-borderLine flex items-center justify-between">
                  <span>Target: {sc.expectedSummary}</span>
                  <span className="text-[11px] text-secondaryText font-mono">Not executed yet</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
