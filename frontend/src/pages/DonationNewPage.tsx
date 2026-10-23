import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { Restaurant } from '../types';
import { getStatusMeta } from '../utils/status';
import {
  UtensilsCrossed,
  Clock,
  Thermometer,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  PackageCheck,
  Building2,
  Info,
  Sparkles
} from 'lucide-react';

interface DonationNewPageProps {
  onNavigate: (route: string) => void;
}

export const DonationNewPage: React.FC<DonationNewPageProps> = ({ onNavigate }) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [foodName, setFoodName] = useState('');
  const [foodType, setFoodType] = useState('hot_prepared_meals');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(25);
  const [unit, setUnit] = useState('meal_boxes');

  // Helper to format Date in local timezone for datetime-local input
  const formatLocalDateTime = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Timestamps in browser local time
  const now = new Date();
  const defaultPrep = formatLocalDateTime(new Date(now.getTime() - 25 * 60000));
  const defaultDeadline = formatLocalDateTime(new Date(now.getTime() + 2.5 * 3600000));

  const [preparedAt, setPreparedAt] = useState(defaultPrep);
  const [pickupDeadline, setPickupDeadline] = useState(defaultDeadline);
  const [pickupAddress, setPickupAddress] = useState('');
  const [storageTemp, setStorageTemp] = useState<number>(63.5);
  const [packagingSealed, setPackagingSealed] = useState(true);

  // Quick preset handlers for testing
  const setFreshPreset = () => {
    const cur = new Date();
    setPreparedAt(formatLocalDateTime(new Date(cur.getTime() - 25 * 60000)));
    setPickupDeadline(formatLocalDateTime(new Date(cur.getTime() + 2.5 * 3600000)));
    setStorageTemp(63.5);
  };

  const setUnsafePreset = () => {
    const cur = new Date();
    setPreparedAt(formatLocalDateTime(new Date(cur.getTime() - 5 * 3600000)));
    setPickupDeadline(formatLocalDateTime(new Date(cur.getTime() + 1 * 3600000)));
    setStorageTemp(35.0);
  };

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successDonation, setSuccessDonation] = useState<any | null>(null);

  useEffect(() => {
    api.getRestaurants()
      .then((rests) => {
        setRestaurants(rests);
        if (rests.length > 0) {
          setSelectedRestaurantId(rests[0].id);
          setPickupAddress(rests[0].address);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const handleRestaurantChange = (id: string) => {
    setSelectedRestaurantId(id);
    const r = restaurants.find((x) => x.id === id);
    if (r) {
      setPickupAddress(r.address);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Form validation
    if (!foodName.trim()) {
      setError('Food item name is required.');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (!pickupAddress.trim()) {
      setError('Pickup dispatch address is required.');
      return;
    }

    const prepDate = new Date(preparedAt);
    const deadlineDate = new Date(pickupDeadline);

    if (deadlineDate <= prepDate) {
      setError('Pickup deadline must occur after the food preparation timestamp.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        restaurant_id: selectedRestaurantId,
        food_name: foodName.trim(),
        food_type: foodType,
        description: description.trim() || undefined,
        quantity: Number(quantity),
        unit,
        prepared_at: prepDate.toISOString(),
        pickup_deadline: deadlineDate.toISOString(),
        pickup_address: pickupAddress.trim(),
        storage_temp_celsius: Number(storageTemp),
        packaging_sealed: packagingSealed,
        safety_evidence: {
          operator_initials: 'ML',
          thermometer_calibrated: true,
          removed_from_temperature_control_at: prepDate.toISOString(),
          applicable_rule: 'TPHC_4_HOUR'
        }
      };

      const result = await api.createDonation(payload);
      setSuccessDonation(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Failed to persist donation record.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-borderLine">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('/donations')}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
          <div>
            <h2 className="text-xl font-bold font-heading text-primaryText tracking-tight">
              New Donation
            </h2>
            <p className="text-xs text-secondaryText">
              Register surplus prepared meals. Submissions are immediately validated against FDA Food Code §3-501.19 limits.
            </p>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successDonation && (
        <Card className="bg-[#EBF5EE] border-[#C7E3D0] space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-brandSuccess flex-shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-primaryText">
                  Donation Successfully Created ({successDonation.id})
                </h4>
                <p className="text-xs text-secondaryText">
                  Status: <strong>{getStatusMeta(successDonation.status).label}</strong>. Record persisted in SQLite backend.
                </p>
              </div>
            </div>
            <Badge variant={getStatusMeta(successDonation.status).variant}>
              {getStatusMeta(successDonation.status).label}
            </Badge>
          </div>

          <div className="flex items-center gap-3 pt-2">
            {successDonation.status === 'AWAITING_MATCH' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNavigate('/matching')}
              >
                Proceed to NGO Matching
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSuccessDonation(null);
                setFoodName('');
                setDescription('');
              }}
            >
              Register Another Batch
            </Button>
          </div>
        </Card>
      )}

      {/* Error Notification */}
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

      {/* Form with 8-pt Grouping & Required Indicators */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Group 1: Origin & Food Information */}
        <Card padding="md" className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-borderLine">
            <Building2 className="w-4 h-4 text-forest" />
            <h3 className="font-heading font-bold text-sm text-primaryText uppercase tracking-wider">
              1. Origin & Food Item
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-primaryText mb-1.5">
                Origin Restaurant <span className="text-accent">*</span>
              </label>
              <select
                value={selectedRestaurantId}
                onChange={(e) => handleRestaurantChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText"
                required
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.cuisine_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-primaryText mb-1.5">
                Food Item Title <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="e.g. Roasted Mediterranean Vegetable Grain Bowls"
                className="w-full px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-primaryText mb-1.5">
                Food Classification <span className="text-accent">*</span>
              </label>
              <select
                value={foodType}
                onChange={(e) => setFoodType(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText"
              >
                <option value="hot_prepared_meals">Hot Prepared Meals (≥ 60.0°C)</option>
                <option value="chilled_prepared_meals">Chilled Prepared Meals (≤ 5.0°C)</option>
                <option value="ambient_bakery">Ambient Bakery & Dry Grains</option>
                <option value="fresh_produce">Fresh Washed Produce</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-primaryText mb-1.5">
                Description / Dietary Notes
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Vegetarian, contains dairy, prepared in nut-free kitchen"
                className="w-full px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText"
              />
            </div>
          </div>
        </Card>

        {/* Group 2: Quantity & Packaging */}
        <Card padding="md" className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-borderLine">
            <PackageCheck className="w-4 h-4 text-forest" />
            <h3 className="font-heading font-bold text-sm text-primaryText uppercase tracking-wider">
              2. Quantity & Packaging Integrity
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-primaryText mb-1.5">
                Quantity <span className="text-accent">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-primaryText mb-1.5">
                Unit of Measure <span className="text-accent">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText"
              >
                <option value="meal_boxes">Meal Boxes</option>
                <option value="portions">Portions</option>
                <option value="steam_trays">Steam Table Trays</option>
                <option value="kg">Kilograms</option>
              </select>
            </div>

            <div className="pt-4 sm:pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={packagingSealed}
                  onChange={(e) => setPackagingSealed(e.target.checked)}
                  className="rounded border-borderLine text-forest focus:ring-forest h-4 w-4"
                />
                <span className="text-xs text-primaryText font-medium">
                  Tamper-evident seal intact
                </span>
              </label>
              <span className="text-[11px] text-secondaryText block mt-1">
                Required for safe transport under hygiene rules.
              </span>
            </div>
          </div>
        </Card>

        {/* Group 3: Time & Temperature Control (FDA §3-501.19) */}
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-borderLine">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-forest" />
              <h3 className="font-heading font-bold text-sm text-primaryText uppercase tracking-wider">
                3. Food Safety & Temperature Control
              </h3>
            </div>
            <span className="text-[11px] font-mono text-secondaryText">
              FDA §3-501.19 & Codex CAC/RCP 39-1993
            </span>
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-2 text-xs pb-1">
            <span className="text-[11px] text-secondaryText font-medium">Quick Demo Presets:</span>
            <button
              type="button"
              onClick={setFreshPreset}
              className="px-2.5 py-1 rounded bg-[#EBF5EE] text-forest border border-[#C7E3D0] hover:bg-forest hover:text-white transition-colors cursor-pointer text-[11px] font-semibold"
            >
              Fresh Hot Batch (Safe / Awaiting Match)
            </button>
            <button
              type="button"
              onClick={setUnsafePreset}
              className="px-2.5 py-1 rounded bg-[#FBEBEA] text-brandError border border-[#F2C2BF] hover:bg-brandError hover:text-white transition-colors cursor-pointer text-[11px] font-semibold"
            >
              Expired Batch (5h ago / Test TC2 Safety Block)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-primaryText mb-1.5">
                Preparation Timestamp <span className="text-accent">*</span>
              </label>
              <input
                type="datetime-local"
                value={preparedAt}
                onChange={(e) => setPreparedAt(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-primaryText mb-1.5">
                Holding Temp (°C) <span className="text-accent">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                value={storageTemp}
                onChange={(e) => setStorageTemp(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText font-mono"
                required
              />
              <span className="text-[10px] text-secondaryText mt-1 block">
                ≥60°C for hot held, ≤5°C for refrigerated
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-primaryText mb-1.5">
                Requested Pickup Deadline <span className="text-accent">*</span>
              </label>
              <input
                type="datetime-local"
                value={pickupDeadline}
                onChange={(e) => setPickupDeadline(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText font-mono"
                required
              />
            </div>
          </div>

          {/* Educational Safety Guideline Callout */}
          <div className="p-3 rounded-[6px] bg-[#FAFBF9] border border-borderLine text-xs text-secondaryText flex items-start gap-2">
            <Info className="w-4 h-4 text-forest flex-shrink-0 mt-0.5" />
            <p>
              <strong>Food Safety Enforcement:</strong> Under Time-as-a-Public-Health-Control rules, food prepared more than 240 minutes ago without temperature control will be <strong>deterministically rejected</strong>. Minimum dispatch advance notice is 30 minutes.
            </p>
          </div>
        </Card>

        {/* Group 4: Pickup Dispatch Address */}
        <Card padding="md" className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-borderLine">
            <Clock className="w-4 h-4 text-forest" />
            <h3 className="font-heading font-bold text-sm text-primaryText uppercase tracking-wider">
              4. Pickup Dispatch Address
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-primaryText mb-1.5">
              Kitchen / Loading Dock Address <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-[7px] border border-borderLine bg-white focus:outline-none focus:ring-2 focus:ring-forest text-primaryText"
              placeholder="e.g. 742 Evergreen Terrace, Service Dock B"
              required
            />
          </div>
        </Card>

        {/* Form Actions or Success State */}
        {successDonation ? (
          <div className="p-4 rounded-[10px] bg-[#EBF5EE] border border-[#C7E3D0] space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-brandSuccess flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-primaryText">
                    Donation Successfully Registered! ({successDonation.id})
                  </h4>
                  <p className="text-xs text-secondaryText">
                    Status: <strong className="text-forest">{getStatusMeta(successDonation.status).label}</strong>. Ready for autonomous AI agent matching.
                  </p>
                </div>
              </div>
              <Badge variant={getStatusMeta(successDonation.status).variant}>
                {getStatusMeta(successDonation.status).label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-[#C7E3D0]/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSuccessDonation(null);
                  setFoodName('');
                  setDescription('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                + Register Another Batch
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigate('/donations')}
              >
                View Donations Directory
              </Button>
              {successDonation.status === 'AWAITING_MATCH' && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => onNavigate('/matching')}
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  Proceed to NGO Matching (Next Step)
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onNavigate('/donations')}
              disabled={isLoading}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Register Donation Batch
            </Button>
          </div>
        )}
      </form>

      {/* Centered Success Modal for Immediate Visual Confirmation */}
      {successDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[12px] max-w-lg w-full p-6 space-y-5 border border-borderLine shadow-xl">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-borderLine">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#EBF5EE] border border-[#C7E3D0] flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-brandSuccess" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-primaryText">
                    Donation Batch Registered!
                  </h3>
                  <p className="text-xs font-mono text-secondaryText">
                    ID: <strong className="text-primaryText">{successDonation.id}</strong> • Status: <span className="text-brandSuccess font-bold font-sans">{getStatusMeta(successDonation.status).label}</span>
                  </p>
                </div>
              </div>
              <Badge variant={getStatusMeta(successDonation.status).variant}>
                {getStatusMeta(successDonation.status).label}
              </Badge>
            </div>

            <div className="bg-ivory/70 p-3.5 rounded-[8px] border border-borderLine text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-secondaryText">Food Item:</span>
                <strong className="text-primaryText">{successDonation.food_name || foodName} ({successDonation.quantity} {successDonation.unit})</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-secondaryText">Food Safety Engine:</span>
                <span className="text-brandSuccess font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Validated Under FDA §3-501.19
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondaryText">Next Step in Pipeline:</span>
                <span className="text-primaryText font-medium">Autonomous NGO Capacity & Transit Match</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSuccessDonation(null);
                  setFoodName('');
                  setDescription('');
                }}
                className="w-full sm:w-auto"
              >
                + Register Another Batch
              </Button>
              {successDonation.status === 'AWAITING_MATCH' && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => onNavigate('/matching')}
                  icon={<Sparkles className="w-4 h-4" />}
                  className="w-full sm:w-auto"
                >
                  Proceed to NGO Matching
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
