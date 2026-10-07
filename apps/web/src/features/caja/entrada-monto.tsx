import { formatearCOP } from '@mb/shared';
import { NumericKeypad } from '@/components/pos/numeric-keypad';
import { digitosAPesos } from '@/lib/format';

/** Monto en pantalla editado con el NumericKeypad. */
export function EntradaMonto({ etiqueta, digitos, onCambio }: { etiqueta: string; digitos: string; onCambio: (d: string) => void }) {
  const editar = (fn: (a: string) => string) => onCambio(fn(digitos).replace(/^0+(?=\d)/, '').slice(0, 9));
  return (
    <div className="flex max-w-sm flex-col gap-3">
      <div className="rounded-lg border bg-card px-4 py-3">
        <p className="text-sm font-medium text-muted-foreground">{etiqueta}</p>
        <p aria-live="polite" className="tabular font-display text-4xl font-extrabold">
          {formatearCOP(digitosAPesos(digitos))}
        </p>
      </div>
      <NumericKeypad
        onDigito={(d) => editar((a) => a + d)}
        onBorrar={() => editar((a) => a.slice(0, -1))}
        onLimpiar={() => onCambio('')}
        onAtajoMonto={(m) => onCambio(String(m))}
      />
    </div>
  );
}
