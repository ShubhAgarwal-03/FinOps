import { Check } from 'lucide-react';
import { cn } from '../../../../libs/shared/utils';

export interface WorkflowStep {
  label: string;
  status: 'complete' | 'current' | 'upcoming';
}

interface Props {
  steps: WorkflowStep[];
}

export default function WorkflowStepper({ steps }: Props) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <div className="flex flex-col items-center gap-1 min-w-[80px]">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors',
                step.status === 'complete' && 'bg-blue-600 border-blue-600 text-white',
                step.status === 'current'  && 'bg-white border-blue-600 text-blue-600',
                step.status === 'upcoming' && 'bg-white border-slate-300 text-slate-400',
              )}
            >
              {step.status === 'complete' ? <Check size={12} /> : i + 1}
            </div>
            <span
              className={cn(
                'text-[10px] font-medium text-center leading-tight',
                step.status === 'complete' && 'text-blue-600',
                step.status === 'current'  && 'text-slate-900',
                step.status === 'upcoming' && 'text-slate-400',
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'h-0.5 w-8 mb-4 mx-1 flex-shrink-0',
                step.status === 'complete' ? 'bg-blue-600' : 'bg-slate-200'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}