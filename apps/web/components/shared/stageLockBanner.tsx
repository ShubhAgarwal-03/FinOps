'use client';

import { Lock } from 'lucide-react';

// Drop into a list page's header area when the stage's prerequisite hasn't
// been met yet. The list itself still renders (usually empty) — only the
// "New …" action is withheld, via `hideCreate` on the caller side.
export default function StageLockBanner({ reason }: { reason: string }) {
  if (!reason) return null;
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3 mb-4">
      <Lock className="w-4 h-4 flex-shrink-0" />
      <span>{reason}</span>
    </div>
  );
}