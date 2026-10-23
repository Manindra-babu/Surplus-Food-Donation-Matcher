import React, { useEffect, useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { AgentRun } from '../types';
import { getStatusMeta } from '../utils/status';
import { formatISTTime } from '../utils/time';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Bot,
  FileCode,
  ShieldCheck,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AgentRunDetailPageProps {
  runId: string;
  onNavigate: (route: string) => void;
}

export const AgentRunDetailPage: React.FC<AgentRunDetailPageProps> = ({ runId, onNavigate }) => {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    api.getAgentRun(runId)
      .then((data) => setRun(data))
      .catch((err) => setError(err.message || 'Failed to retrieve agent run evidence.'))
      .finally(() => setIsLoading(false));
  }, [runId]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleStep = (stepNum: number) => {
    setExpandedStep((prev) => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-secondaryText text-xs space-y-2">
        <Activity className="w-5 h-5 animate-spin mx-auto text-forest" />
        <p>Loading agent execution trace from platform ledger...</p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate('/agent-runs')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Ledger
        </Button>
        <div className="p-4 rounded-[8px] bg-[#FBEBEA] border border-[#F2C2BF] text-brandError text-xs">
          {error || 'Agent run not found.'}
        </div>
      </div>
    );
  }

  const statusMeta = getStatusMeta(run.status, 'run');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-borderLine">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('/agent-runs')}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-heading text-primaryText tracking-tight font-mono">
                {run.id}
              </h2>
              <Badge variant={statusMeta.variant}>
                {statusMeta.label}
              </Badge>
            </div>
            <p className="text-xs text-secondaryText">
              Scope: <strong className="text-primaryText">{run.scenario_id || 'Live Donation Intake'}</strong> • Stage: <span className="font-mono">{run.current_stage}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-secondaryText">
          <Clock className="w-3.5 h-3.5 text-forest" />
          <span>Started: {formatISTTime(run.started_at)}</span>
          {run.completed_at && (
            <span>• Completed: {formatISTTime(run.completed_at)}</span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card padding="sm" className="space-y-1">
          <span className="text-secondaryText text-[11px] font-semibold uppercase tracking-wider block">
            Intelligence Engine
          </span>
          <div className="flex items-center gap-1.5 font-bold text-sm text-primaryText">
            <Bot className="w-4 h-4 text-forest" />
            <span>{run.is_llm_powered ? 'Google Gemini 2.5' : 'Deterministic Rules'}</span>
          </div>
          <span className="text-[11px] text-secondaryText block">
            {run.fallback_used ? 'Deterministic Fallback' : 'Active LLM Reasoning'}
          </span>
        </Card>

        <Card padding="sm" className="space-y-1">
          <span className="text-secondaryText text-[11px] font-semibold uppercase tracking-wider block">
            Scope Reference
          </span>
          <div className="font-mono font-bold text-sm text-primaryText truncate">
            {run.donation_id || 'N/A'}
          </div>
          <span className="text-[11px] text-secondaryText block">
            Pickup ID: {run.pickup_request_id || 'None'}
          </span>
        </Card>

        <Card padding="sm" className="space-y-1">
          <span className="text-secondaryText text-[11px] font-semibold uppercase tracking-wider block">
            Audit Ledger
          </span>
          <div className="flex items-center gap-1.5 font-bold text-sm text-brandSuccess">
            <CheckCircle2 className="w-4 h-4" />
            <span>{run.execution_trace.length} Verifiable Stages</span>
          </div>
          <span className="text-[11px] text-secondaryText block">
            Recorded in SQLite Database
          </span>
        </Card>
      </div>

      {/* Chronological 10-Stage Trace Timeline */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-borderLine">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-forest" />
            <h3 className="font-heading font-bold text-sm text-primaryText uppercase tracking-wider">
              Chronological Execution Trace
            </h3>
          </div>
          <span className="text-xs text-secondaryText">
            10-Stage Auditable Workflow
          </span>
        </div>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-borderLine">
          {run.execution_trace.map((step) => {
            const isSuccess = step.status === 'SUCCESS';
            const isFailed = step.status === 'FAILED' || step.status === 'BLOCKED';
            const isWarning = step.status === 'WARNING' || step.status === 'PENDING_APPROVAL';
            const hasData = step.data && Object.keys(step.data).length > 0;
            const isStepExpanded = !!expandedStep[step.step_number];

            return (
              <div key={step.step_number} className="relative">
                {/* Node */}
                <div
                  className={`absolute -left-6 mt-1 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center text-[10px] font-bold ${
                    isSuccess
                      ? 'border-brandSuccess text-brandSuccess'
                      : isFailed
                      ? 'border-brandError text-brandError bg-[#FFFBFB]'
                      : 'border-brandWarning text-brandWarning bg-[#FDFBF7]'
                  }`}
                >
                  {step.step_number}
                </div>

                <div className="p-3.5 rounded-[8px] bg-white border border-borderLine space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primaryText">
                        Stage {step.step_number}: {step.stage}
                      </span>
                      <Badge
                        variant={isSuccess ? 'success' : isFailed ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {step.status}
                      </Badge>
                    </div>

                    <span className="font-mono text-[10px] text-secondaryText">
                      {formatISTTime(step.timestamp)}
                    </span>
                  </div>

                  <p className="text-xs text-primaryText leading-relaxed">
                    {step.message}
                  </p>

                  {/* Collapsible Step Payload */}
                  {hasData && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => toggleStep(step.step_number)}
                        className="text-[11px] text-forest hover:text-forest-dark font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isStepExpanded ? 'Hide Payload' : 'Inspect Step Data'}</span>
                        {isStepExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {isStepExpanded && (
                        <pre className="mt-2 p-2.5 rounded-[5px] bg-[#FAFBF9] text-[11px] font-mono text-secondaryText overflow-x-auto border border-borderLine max-h-48 leading-relaxed">
                          {JSON.stringify(step.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Evidence Panels: Input Snapshot & Verified State */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input Snapshot */}
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-borderLine">
            <span className="text-xs font-bold text-primaryText flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-forest" />
              <span>Input Snapshot</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(JSON.stringify(run.input_snapshot, null, 2), 'input')}
              icon={copiedKey === 'input' ? <Check className="w-3.5 h-3.5 text-brandSuccess" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedKey === 'input' ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <pre className="p-3 rounded-[6px] bg-[#FAFBF9] text-[11px] font-mono text-secondaryText overflow-x-auto max-h-60 border border-borderLine leading-relaxed">
            {JSON.stringify(run.input_snapshot, null, 2)}
          </pre>
        </Card>

        {/* Verified Database State */}
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-borderLine">
            <span className="text-xs font-bold text-primaryText flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-forest" />
              <span>Verified Database State</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(JSON.stringify(run.verified_state, null, 2), 'verified')}
              icon={copiedKey === 'verified' ? <Check className="w-3.5 h-3.5 text-brandSuccess" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedKey === 'verified' ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <pre className="p-3 rounded-[6px] bg-[#FAFBF9] text-[11px] font-mono text-primaryText overflow-x-auto max-h-60 border border-borderLine leading-relaxed">
            {JSON.stringify(run.verified_state, null, 2)}
          </pre>
        </Card>
      </div>
    </div>
  );
};
