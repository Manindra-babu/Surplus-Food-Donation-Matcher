import React, { useEffect, useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { AgentRun } from '../types';
import { getStatusMeta } from '../utils/status';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  Bot,
  ShieldCheck,
  FileCode
} from 'lucide-react';

interface AgentRunsPageProps {
  onNavigate: (route: string) => void;
}

export const AgentRunsPage: React.FC<AgentRunsPageProps> = ({ onNavigate }) => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [filterScenario, setFilterScenario] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getAgentRuns();
      setRuns(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch agent runs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const filterTabs = [
    { key: 'ALL', label: 'All Executions' },
    { key: 'TC1', label: 'TC1 (Fresh Food)' },
    { key: 'TC2', label: 'TC2 (Safety Block)' },
    { key: 'TC3', label: 'TC3 (Unaccepted)' },
    { key: 'TC4', label: 'TC4 (Location Change)' },
    { key: 'LIVE_INTERACTIVE', label: 'Live Intake' },
  ];

  const filteredRuns = runs.filter((r) => {
    if (filterScenario === 'ALL') return true;
    return r.scenario_id === filterScenario;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-borderLine">
        <div>
          <h2 className="text-xl font-bold font-heading text-primaryText tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-forest" />
            <span>Agent Runs and Evidence</span>
          </h2>
          <p className="text-xs text-secondaryText">
            Immutable 10-stage trace logs recorded across live donations and official test scenarios.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadRuns}
          isLoading={isLoading}
        >
          Refresh Ledger
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilterScenario(tab.key)}
            className={`px-3 py-1.5 rounded-[6px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
              filterScenario === tab.key
                ? 'bg-forest text-white'
                : 'bg-white border border-borderLine text-secondaryText hover:text-primaryText hover:bg-ivory'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-[8px] bg-[#FBEBEA] border border-[#F2C2BF] text-brandError text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Ledger Table */}
      <Card padding="none" className="overflow-hidden">
        {filteredRuns.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Activity className="w-8 h-8 text-secondaryText/40 mx-auto" />
            <p className="text-sm font-semibold text-primaryText">No agent runs recorded in database</p>
            <p className="text-xs text-secondaryText">
              Run an NGO matching evaluation or test scenario to generate trace records.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('/test-scenarios')}
              className="mt-2"
            >
              Run Official Scenarios
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F9F6] border-b border-borderLine text-secondaryText font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-4">Execution ID</th>
                  <th className="py-2.5 px-4">Scope / Scenario</th>
                  <th className="py-2.5 px-4">Workflow Stage</th>
                  <th className="py-2.5 px-4">Outcome</th>
                  <th className="py-2.5 px-4">Model Engine</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {filteredRuns.map((r) => {
                  const statusMeta = getStatusMeta(r.status, 'run');

                  return (
                    <tr key={r.id} className="hover:bg-ivory/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-primaryText whitespace-nowrap">
                        {r.id}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-primaryText">
                          {r.scenario_id || 'Live Donation'}
                        </span>
                        {r.donation_id && (
                          <div className="text-[11px] font-mono text-secondaryText">
                            {r.donation_id}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-primaryText whitespace-nowrap">
                        {r.current_stage}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant={statusMeta.variant} size="sm">
                          {statusMeta.label}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-primaryText">
                          <Bot className="w-3.5 h-3.5 text-forest" />
                          <span>{r.is_llm_powered ? 'Gemini 2.5' : 'Deterministic'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-secondaryText font-mono text-[11px] whitespace-nowrap">
                        {new Date(r.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onNavigate(`/agent-runs/${r.id}`)}
                          icon={<FileCode className="w-3 h-3 text-forest" />}
                        >
                          Inspect Trace
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
  );
};
