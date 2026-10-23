import React, { useEffect, useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { Donation } from '../types';
import { getStatusMeta } from '../utils/status';
import { formatISTShortTime } from '../utils/time';
import {
  UtensilsCrossed,
  PlusCircle,
  Network,
  Clock,
  Thermometer,
  ShieldAlert,
  CheckCircle2,
  Search,
  ArrowRight
} from 'lucide-react';

interface DonationsPageProps {
  onNavigate: (route: string) => void;
}

export const DonationsPage: React.FC<DonationsPageProps> = ({ onNavigate }) => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDonations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getDonations();
      setDonations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch donations.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDonations();
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id');
    if (targetId) {
      setSearchQuery(targetId);
    }
  }, []);

  const filterTabs = [
    { key: 'ALL', label: 'All Intake' },
    { key: 'AWAITING_MATCH', label: 'Awaiting Match' },
    { key: 'PENDING_APPROVAL', label: 'Proposal Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED_SAFETY', label: 'Rejected for Safety' },
    { key: 'COMPLETED', label: 'Collected (Verified)' }
  ];

  const filteredDonations = donations.filter((d) => {
    const matchesStatus = filterStatus === 'ALL' || d.status === filterStatus;
    const matchesSearch =
      d.food_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.restaurant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-borderLine">
        <div>
          <h2 className="text-xl font-bold font-heading text-primaryText tracking-tight">
            Donations
          </h2>
          <p className="text-xs text-secondaryText">
            Registered prepared food batches and real-time safety status under FDA Food Code §3-501.19.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => onNavigate('/donations/new')}
          icon={<PlusCircle className="w-3.5 h-3.5" />}
        >
          New Donation
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 rounded-[6px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                filterStatus === tab.key
                  ? 'bg-forest text-white'
                  : 'bg-white border border-borderLine text-secondaryText hover:text-primaryText hover:bg-ivory'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondaryText" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, restaurant, item..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText"
          />
        </div>
      </div>

      {/* Table View */}
      <Card padding="none" className="overflow-hidden">
        {filteredDonations.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <UtensilsCrossed className="w-8 h-8 text-secondaryText/40 mx-auto" />
            <p className="text-sm font-semibold text-primaryText">No donations found</p>
            <p className="text-xs text-secondaryText">
              Try adjusting your filter or search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F9F6] border-b border-borderLine text-secondaryText font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-4">Donation ID</th>
                  <th className="py-2.5 px-4">Origin & Food Item</th>
                  <th className="py-2.5 px-4">Quantity</th>
                  <th className="py-2.5 px-4">Holding Temp & Seal</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine">
                {filteredDonations.map((d) => {
                  const statusMeta = getStatusMeta(d.status, 'donation');

                  return (
                    <tr key={d.id} className="hover:bg-ivory/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-primaryText whitespace-nowrap">
                        {d.id}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-primaryText truncate max-w-[220px]">
                          {d.food_name}
                        </div>
                        <div className="text-[11px] text-secondaryText truncate max-w-[220px]">
                          {d.restaurant_name} • {d.food_type.replace(/_/g, ' ')}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-primaryText">{d.quantity}</span>{' '}
                        <span className="text-secondaryText text-[11px]">{d.unit}</span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-primaryText">
                          <Thermometer className="w-3.5 h-3.5 text-forest" />
                          <span>{d.storage_temp_celsius}°C</span>
                          {d.packaging_sealed && (
                            <span className="text-brandSuccess text-[10px] bg-[#EBF5EE] border border-[#C7E3D0] px-1 rounded">
                              Sealed
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-secondaryText mt-0.5 font-mono">
                          Prep: {formatISTShortTime(d.prepared_at)}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant={statusMeta.variant} size="sm">
                          {statusMeta.label}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {d.status === 'AWAITING_MATCH' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onNavigate('/matching')}
                            icon={<Network className="w-3 h-3 text-forest" />}
                          >
                            Match NGO
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onNavigate('/pickups')}
                          >
                            View Request
                          </Button>
                        )}
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
