import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { t } from '@/i18n/es';

/** Marcador para pantallas que llegan en hitos posteriores del roadmap. */
export function PantallaPendiente({
  titulo,
  icon,
  hito,
}: {
  titulo: string;
  icon: LucideIcon;
  hito: number;
}) {
  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-10">
      <h1 className="mb-6 font-display text-3xl font-bold tracking-tight">{titulo}</h1>
      <EmptyState
        icon={icon}
        titulo={t.pendiente.titulo(titulo)}
        descripcion={t.pendiente.descripcion(hito)}
      />
    </div>
  );
}
