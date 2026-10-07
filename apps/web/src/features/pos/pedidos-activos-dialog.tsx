import { CheckCircle2, Clock, Flame, MapPin, Package, ReceiptText, UserCheck, Utensils } from 'lucide-react';
import { useState } from 'react';
import { formatearCOP, type MesaConEstado, type Pedido } from '@mb/shared';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { t } from '@/i18n/es';

export interface PedidosActivosDialogProps {
  abierto: boolean;
  pedidos: Pedido[];
  mesas: MesaConEstado[];
  onCerrar: () => void;
  onSeleccionarPedido: (pedidoId: string) => void;
  onSeleccionarMesaLibre: (mesaId: string) => void;
}

export function PedidosActivosDialog({
  abierto,
  pedidos,
  mesas,
  onCerrar,
  onSeleccionarPedido,
  onSeleccionarMesaLibre,
}: PedidosActivosDialogProps) {
  const [tab, setTab] = useState<'pedidos' | 'mesas'>('pedidos');

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <ReceiptText className="size-5 text-primary" aria-hidden="true" />
            {t.pos.activos}
          </DialogTitle>
          <DialogDescription>{t.pos.activosDescripcion}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <ToggleGroup
            type="single"
            value={tab}
            onValueChange={(val) => {
              if (val === 'pedidos' || val === 'mesas') setTab(val);
            }}
            variant="outline"
            className="w-full justify-start"
          >
            <ToggleGroupItem value="pedidos" className="h-11 px-5 font-semibold">
              <ReceiptText className="mr-1.5 size-4" aria-hidden="true" />
              {t.pos.tabPedidos} ({pedidos.length})
            </ToggleGroupItem>
            <ToggleGroupItem value="mesas" className="h-11 px-5 font-semibold">
              <Utensils className="mr-1.5 size-4" aria-hidden="true" />
              {t.pos.tabMesas} ({mesas.length})
            </ToggleGroupItem>
          </ToggleGroup>

          {tab === 'pedidos' ? (
            pedidos.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                titulo={t.pos.activosVacio}
                descripcion=""
                className="py-10"
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {pedidos.map((p) => {
                  const confirmado = p.estado === 'CONFIRMADO';
                  const cantItems = p.items.reduce((acc, it) => acc + it.cantidad, 0);

                  return (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-lg font-bold">
                            {t.pos.pedido(p.numeroDia)}
                          </span>
                          {confirmado ? (
                            <Badge variant="outline" className="gap-1 border-warning/40 bg-warning/15 text-warning">
                              <Flame className="size-3.5" aria-hidden="true" />
                              {t.pos.enCocina}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 bg-secondary text-secondary-foreground">
                              <Clock className="size-3.5" aria-hidden="true" />
                              {t.pos.abierto}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium">
                            {p.tipo === 'MESA' ? (
                              <>
                                <MapPin className="size-3.5" aria-hidden="true" />
                                {p.mesa?.nombre ?? t.pos.tipoMesa}
                              </>
                            ) : (
                              <>
                                <Package className="size-3.5" aria-hidden="true" />
                                {t.pos.tipoLlevar}
                              </>
                            )}
                          </span>
                          <span>•</span>
                          <span>
                            {cantItems} {cantItems === 1 ? t.pos.productoSingular : t.pos.productoPlural}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="tabular font-display text-lg font-bold text-foreground">
                          {formatearCOP(p.total)}
                        </span>
                        <Button
                          type="button"
                          className="h-12 min-h-12 min-w-28 font-semibold"
                          variant={confirmado ? 'default' : 'outline'}
                          onClick={() => {
                            onSeleccionarPedido(p.id);
                            onCerrar();
                          }}
                        >
                          {confirmado ? t.pos.cobrar : t.pos.abrirPedido}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {mesas.map((m) => {
                return (
                  <div
                    key={m.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col">
                        <span className="font-display text-base font-bold text-foreground">
                          {m.nombre}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Capacidad: {m.capacidad} personas
                        </span>
                      </div>

                      {m.ocupada ? (
                        <Badge variant="outline" className="gap-1 border-destructive/30 bg-destructive/15 text-destructive font-semibold">
                          <UserCheck className="size-3.5" aria-hidden="true" />
                          {t.pos.mesaOcupada}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-success/30 bg-success/15 text-success font-semibold">
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          {t.pos.mesaLibre}
                        </Badge>
                      )}
                    </div>

                    {m.ocupada && m.pedidoId ? (
                      <Button
                        type="button"
                        className="h-11 min-h-11 w-full font-semibold"
                        onClick={() => {
                          onSeleccionarPedido(m.pedidoId!);
                          onCerrar();
                        }}
                      >
                        {t.pos.abrirPedido}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 min-h-11 w-full font-medium"
                        onClick={() => {
                          onSeleccionarMesaLibre(m.id);
                          onCerrar();
                        }}
                      >
                        {t.pos.seleccionarMesa}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="h-12 min-h-12 px-6" onClick={onCerrar}>
            {t.pos.cerrar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
