import React from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Truck,
  UserCheck,
  ShieldAlert,
  RotateCcw,
  FileText
} from 'lucide-react';

export type StatusVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'forest' | 'info';

export interface StatusMeta {
  label: string;
  variant: StatusVariant;
  description: string;
}

/**
 * Standardized workflow terminology as required:
 * - Draft
 * - Awaiting Match
 * - Proposal Pending
 * - Awaiting Human Approval
 * - Approved, Awaiting NGO Acceptance
 * - Accepted by NGO
 * - Reconfirmation Required
 * - Rejected for Safety
 * - Collected (Verified)
 * - Failed
 */
export function getStatusMeta(status: string | undefined | null, context?: 'donation' | 'pickup' | 'run'): StatusMeta {
  if (!status) {
    return {
      label: 'Draft',
      variant: 'neutral',
      description: 'Record is in initial state'
    };
  }

  const s = status.toUpperCase().trim();

  switch (s) {
    // Awaiting Match
    case 'AWAITING_MATCH':
      return {
        label: 'Awaiting Match',
        variant: 'neutral',
        description: 'Surplus food registered and waiting for NGO matching evaluation'
      };

    // Proposal Pending / Awaiting Human Approval
    case 'PROPOSED':
    case 'PENDING_APPROVAL':
    case 'REQUIRES_APPROVAL':
      return {
        label: 'Awaiting Human Approval',
        variant: 'warning',
        description: 'Candidate NGO selected; awaiting restaurant operator sign-off'
      };

    // Approved, Awaiting NGO Acceptance
    case 'APPROVED':
      return {
        label: 'Approved, Awaiting NGO Acceptance',
        variant: 'info',
        description: 'Approved by restaurant operator; pending confirmation from recipient NGO'
      };

    // Accepted by NGO
    case 'ACCEPTED_BY_NGO':
    case 'ACCEPTED':
      return {
        label: 'Accepted by NGO (Awaiting Collection)',
        variant: 'forest',
        description: 'NGO confirmed pickup window and destination drop-off facility. Ready for physical collection.'
      };

    // Reconfirmation Required
    case 'LOCATION_CHANGED':
    case 'RECONFIRMATION_REQUIRED':
    case 'REQUIRES_RECONFIRMATION':
      return {
        label: 'Reconfirmation Required',
        variant: 'danger',
        description: 'Drop-off location altered; previous approval invalidated, re-approval mandated'
      };

    // Rejected for Safety
    case 'REJECTED_SAFETY':
    case 'SAFETY_REJECTED':
    case 'REJECTED_FOOD_SAFETY_EXPIRED':
      return {
        label: 'Rejected for Safety',
        variant: 'danger',
        description: 'Elapsed holding duration or temperature limits violate FDA Food Code §3-501.19'
      };

    // Collected / Verified
    case 'COLLECTED':
    case 'VERIFIED_COMPLETE':
    case 'COMPLETED':
    case 'SUCCESS':
      return {
        label: 'Verified Collection',
        variant: 'success',
        description: 'Pickup completed and independently verified against database state'
      };

    // Failed / Rejected
    case 'REJECTED':
    case 'REJECTED_BY_NGO':
      return {
        label: 'Rejected by Recipient NGO',
        variant: 'danger',
        description: 'Recipient NGO declined dispatch. Donation reopened for matching.'
      };

    case 'VERIFICATION_FAILED':
      return {
        label: 'Verification Failure',
        variant: 'danger',
        description: 'Independent query could not verify pickup state on platform'
      };

    case 'FAILED':
    case 'CANCELLED':
      return {
        label: 'Failed',
        variant: 'danger',
        description: 'Workflow terminated or request cancelled'
      };

    case 'MATCHED':
      return {
        label: 'Proposal Pending',
        variant: 'info',
        description: 'Eligible NGO identified; proposal prepared'
      };

    case 'RUNNING':
      return {
        label: 'Evaluating',
        variant: 'neutral',
        description: 'Agent evaluation in progress'
      };

    default:
      return {
        label: status.replace(/_/g, ' '),
        variant: 'neutral',
        description: `Status: ${status}`
      };
  }
}
