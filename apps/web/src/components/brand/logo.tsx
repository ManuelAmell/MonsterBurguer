import { cn } from '@/lib/utils';
import { t } from '@/i18n/es';

/** Marca: la personalidad "monster" vive aquí, no en las pantallas operativas (DESIGN.md §1.6). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-10 shrink-0', className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M7 15a9 7 0 0 1 18 0z" className="fill-background" />
      <rect x="6" y="17" width="20" height="3" rx="1.5" className="fill-accent" />
      <path d="M7 22h18a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3z" className="fill-background" />
      <circle cx="12.5" cy="11.5" r="1.3" className="fill-foreground" />
      <circle cx="19.5" cy="11.5" r="1.3" className="fill-foreground" />
    </svg>
  );
}

export function Logo({ className, compacto = false }: { className?: string; compacto?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark />
      {!compacto && (
        <div className="leading-tight">
          <p className="font-display text-lg font-extrabold tracking-tight">{t.app.nombre}</p>
          <p className="text-xs text-muted-foreground">{t.app.subtitulo}</p>
        </div>
      )}
    </div>
  );
}
