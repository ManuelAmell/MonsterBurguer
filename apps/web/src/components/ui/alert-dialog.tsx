import { Slot } from '@radix-ui/react-slot';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type Dispatch,
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AlertDialogContextValue {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const AlertDialogContext = createContext<AlertDialogContextValue | null>(null);

export interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function AlertDialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: AlertDialogProps) {
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
    <AlertDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogTrigger({
  children,
  asChild = false,
  className,
  onClick,
  ...props
}: ComponentProps<'button'> & { asChild?: boolean }) {
  const context = useContext(AlertDialogContext);
  if (!context) throw new Error('AlertDialogTrigger must be used within AlertDialog');

  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      type="button"
      className={className}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        context.setOpen(true);
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function AlertDialogPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export function AlertDialogOverlay({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-150',
        className,
      )}
      {...props}
    />
  );
}

export function AlertDialogContent({
  className,
  children,
  ...props
}: ComponentProps<'div'>) {
  const context = useContext(AlertDialogContext);
  if (!context) throw new Error('AlertDialogContent must be used within AlertDialog');

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
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div
          role="alertdialog"
          aria-modal="true"
          className={cn(
            'relative w-full max-w-lg rounded-xl border bg-card p-6 text-card-foreground shadow-lg transition-all duration-150 ease-out sm:rounded-2xl',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {children}
        </div>
      </div>
    </AlertDialogPortal>
  );
}

export function AlertDialogHeader({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col space-y-2 text-center sm:text-left', className)}
      {...props}
    />
  );
}

export function AlertDialogFooter({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3',
        className,
      )}
      {...props}
    />
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('font-display text-xl font-bold tracking-tight', className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<'p'>) {
  return (
    <p
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export function AlertDialogAction({
  className,
  onClick,
  ...props
}: ComponentProps<'button'>) {
  const context = useContext(AlertDialogContext);
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: 'destructive' }), className)}
      onClick={(e) => {
        onClick?.(e);
        context?.setOpen(false);
      }}
      {...props}
    />
  );
}

export function AlertDialogCancel({
  className,
  onClick,
  ...props
}: ComponentProps<'button'>) {
  const context = useContext(AlertDialogContext);
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      onClick={(e) => {
        onClick?.(e);
        context?.setOpen(false);
      }}
      {...props}
    />
  );
}
