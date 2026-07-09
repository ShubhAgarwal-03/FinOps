'use client';

import { Check } from 'lucide-react';
import { cn } from '../../../../libs/shared/utils';

export interface WorkflowStep {
  label: string;
  status: 'complete' | 'current' | 'upcoming';
}

interface Props {
  steps: WorkflowStep[];
}

// Horizontal step indicator — used on the VendorInvoiceDetailPage hub:
// Submit -> Match -> Dispute -> Finance Approval -> Payment
export default function WorkflowStepper({ steps }: Props) {
  return (
    <div className="flex items-center w-full overflow-x-auto py-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center flex-shrink-0">
          <div className="flex flex-col items-center gap-1.5 w-24">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 flex-shrink-0',
                step.status === 'complete' && 'bg-blue-600 border-blue-600 text-white',
                step.status === 'current' && 'border-blue-600 text-blue-600 bg-blue-50',
                step.status === 'upcoming' && 'border-slate-200 text-slate-300 bg-white'
              )}
            >
              {step.status === 'complete' ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                'text-xs text-center leading-tight',
                step.status === 'upcoming' ? 'text-slate-300' : 'text-slate-600 font-medium'
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'h-0.5 w-8 -mt-5 flex-shrink-0',
                step.status === 'complete' ? 'bg-blue-600' : 'bg-slate-200'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}