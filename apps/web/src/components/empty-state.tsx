import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  titulo,
  descripcion,
  accion,
  className,
}: {
  icon: LucideIcon;
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-10 text-center',
        className,
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <Icon aria-hidden="true" className="size-8 text-primary" />
      </div>
      <div className="max-w-md space-y-1">
        <h2 className="font-display text-xl font-bold">{titulo}</h2>
        <p className="text-muted-foreground">{descripcion}</p>
      </div>
      {accion}
    </div>
  );
}
