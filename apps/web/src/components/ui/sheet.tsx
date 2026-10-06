import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface SheetContextValue {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const SheetContext = createContext<SheetContextValue | null>(null);

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Sheet({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen: Dispatch<SetStateAction<boolean>> = (value) => {
    const nextOpen = typeof value === 'function' ? value(open) : value;
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetTrigger({
  children,
  asChild = false,
  className,
  onClick,
  ...props
}: ComponentProps<'button'> & { asChild?: boolean }) {
  const context = useContext(SheetContext);
  if (!context) throw new Error('SheetTrigger must be used within Sheet');

  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      type="button"
      className={className}
      onClick={(e: any) => {
        onClick?.(e);
        context.setOpen(true);
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function SheetClose({
  children,
  asChild = false,
  className,
  onClick,
  ...props
}: ComponentProps<'button'> & { asChild?: boolean }) {
  const context = useContext(SheetContext);
  if (!context) throw new Error('SheetClose must be used within Sheet');

  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      type="button"
      className={className}
      onClick={(e: any) => {
        onClick?.(e);
        context.setOpen(false);
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function SheetPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export function SheetOverlay({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-200',
        className,
      )}
      {...props}
    />
  );
}

const sheetVariants = cva(
  'fixed z-50 gap-4 bg-card p-6 shadow-xl transition-transform duration-200 ease-out border-border',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b',
        bottom: 'inset-x-0 bottom-0 border-t',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-md',
        right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-md',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  },
);

export interface SheetContentProps
  extends ComponentProps<'div'>,
    VariantProps<typeof sheetVariants> {
  showCloseButton?: boolean;
}

export function SheetContent({
  side = 'right',
  className,
  children,
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  const context = useContext(SheetContext);
  if (!context) throw new Error('SheetContent must be used within Sheet');

  useEffect(() => {
    if (!context.open) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        context.setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [context]);

  if (!context.open) return null;

  return (
    <SheetPortal>
      <SheetOverlay onClick={() => context.setOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(sheetVariants({ side }), className)}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
        {showCloseButton && (
          <button
            type="button"
            aria-label="Cerrar panel lateral"
            onClick={() => context.setOpen(false)}
            className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97]"
          >
            <X className="size-5" />
          </button>
        )}
      </div>
    </SheetPortal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col space-y-2 text-left', className)}
      {...props}
    />
  );
}

export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3',
        className,
      )}
      {...props}
    />
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('font-display text-xl font-bold tracking-tight', className)}
      {...props}
    />
  );
}

export function SheetDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
