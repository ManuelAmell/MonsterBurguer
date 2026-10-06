import {
  AlertOctagon,
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleSlash,
  Clock,
  Flame,
  PackageCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentProps } from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type EstadoPos =
  | 'comanda_pendiente'
  | 'en_preparacion'
  | 'lista'
  | 'entregada'
  | 'atraso_leve'
  | 'atraso_grave'
  | 'agotado'
  | 'stock_bajo'
  | 'pagado'
  | 'anulado'
  // Compatibilidad con enums del backend / dominio
  | 'PENDIENTE'
  | 'EN_PREPARACION'
  | 'LISTA'
  | 'ENTREGADA'
  | 'ANULADO'
  | 'PAGADO';

interface EstadoConfig {
  variant: NonNullable<BadgeProps['variant']>;
  icon: LucideIcon;
  defaultText: string;
}

export const ESTADOS_CONFIG: Record<string, EstadoConfig> = {
  comanda_pendiente: {
    variant: 'muted',
    icon: Clock,
    defaultText: 'Pendiente',
  },
  PENDIENTE: {
    variant: 'muted',
    icon: Clock,
    defaultText: 'Pendiente',
  },
  en_preparacion: {
    variant: 'info',
    icon: Flame,
    defaultText: 'Preparando',
  },
  EN_PREPARACION: {
    variant: 'info',
    icon: Flame,
    defaultText: 'Preparando',
  },
  lista: {
    variant: 'success',
    icon: CheckCircle2,
    defaultText: 'Lista',
  },
  LISTA: {
    variant: 'success',
    icon: CheckCircle2,
    defaultText: 'Lista',
  },
  entregada: {
    variant: 'muted',
    icon: PackageCheck,
    defaultText: 'Entregada',
  },
  ENTREGADA: {
    variant: 'muted',
    icon: PackageCheck,
    defaultText: 'Entregada',
  },
  atraso_leve: {
    variant: 'warning',
    icon: AlertTriangle,
    defaultText: '+8 min',
  },
  atraso_grave: {
    variant: 'destructive',
    icon: AlertOctagon,
    defaultText: '+12 min',
  },
  agotado: {
    variant: 'destructive',
    icon: CircleSlash,
    defaultText: 'Agotado',
  },
  stock_bajo: {
    variant: 'warning',
    icon: TriangleAlert,
    defaultText: 'Stock bajo',
  },
  pagado: {
    variant: 'success',
    icon: BadgeCheck,
    defaultText: 'Pagado',
  },
  PAGADO: {
    variant: 'success',
    icon: BadgeCheck,
    defaultText: 'Pagado',
  },
  anulado: {
    variant: 'destructive',
    icon: Ban,
    defaultText: 'Anulado',
  },
  ANULADO: {
    variant: 'destructive',
    icon: Ban,
    defaultText: 'Anulado',
  },
};

export interface StatusBadgeProps extends Omit<ComponentProps<'div'>, 'children'> {
  estado: EstadoPos;
  children?: string;
  size?: 'sm' | 'default' | 'lg';
}

export function StatusBadge({
  estado,
  children,
  size = 'default',
  className,
  ...props
}: StatusBadgeProps) {
  const config = ESTADOS_CONFIG[estado] ?? {
    variant: 'muted',
    icon: Clock,
    defaultText: estado,
  };

  const Icon = config.icon;
  const texto = children ?? config.defaultText;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    default: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-medium',
  }[size];

  const iconSizes = {
    sm: 'size-3',
    default: 'size-3.5',
    lg: 'size-4',
  }[size];

  return (
    <Badge
      variant={config.variant}
      className={cn(
        sizeClasses,
        'tabular font-semibold tracking-wide inline-flex items-center shrink-0 select-none',
        className,
      )}
      {...props}
    >
      <Icon className={cn(iconSizes, 'shrink-0')} aria-hidden="true" />
      <span>{texto}</span>
    </Badge>
  );
}
