import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-slate-950/60 text-accent">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  );
}
