import { Slot } from '@radix-ui/react-slot';
import { X } from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type Dispatch,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap({
  containerRef,
  isActive,
  initialFocus,
  onEscape,
}: {
  containerRef: RefObject<HTMLElement | null>;
  isActive: boolean;
  initialFocus?: RefObject<HTMLElement | null> | HTMLElement | null;
  onEscape?: () => void;
}) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const frameId = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      let elementToFocus: HTMLElement | null = null;
      if (initialFocus) {
        elementToFocus = 'current' in initialFocus ? initialFocus.current : initialFocus;
      }

      if (!elementToFocus) {
        const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        elementToFocus = focusable[0] ?? null;
      }

      if (elementToFocus && typeof elementToFocus.focus === 'function') {
        elementToFocus.focus();
      } else {
        container.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onEscape) {
          e.preventDefault();
          e.stopPropagation();
          onEscape();
        }
        return;
      }

      if (e.key === 'Tab') {
        const container = containerRef.current;
        if (!container) return;

        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || !container.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !container.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown, true);

      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        const elem = previousActiveElementRef.current;
        requestAnimationFrame(() => {
          elem.focus();
        });
      }
    };
  }, [isActive, containerRef, initialFocus, onEscape]);
}

interface DialogContextValue {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  titleId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const titleId = useId();

  const setOpen: Dispatch<SetStateAction<boolean>> = (value) => {
    const nextOpen = typeof value === 'function' ? value(open) : value;
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <DialogContext.Provider value={{ open, setOpen, titleId }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  children,
  asChild = false,
  className,
  onClick,
  ...props
}: ComponentProps<'button'> & { asChild?: boolean }) {
  const context = useContext(DialogContext);
  if (!context) throw new Error('DialogTrigger must be used within Dialog');

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

export function DialogClose({
  children,
  asChild = false,
  className,
  onClick,
  ...props
}: ComponentProps<'button'> & { asChild?: boolean }) {
  const context = useContext(DialogContext);
  if (!context) throw new Error('DialogClose must be used within Dialog');

  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      type="button"
      className={className}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        context.setOpen(false);
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function DialogPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export function DialogOverlay({
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

export interface DialogContentProps extends ComponentProps<'div'> {
  showCloseButton?: boolean;
  initialFocus?: RefObject<HTMLElement | null> | HTMLElement | null;
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  initialFocus,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: DialogContentProps) {
  const context = useContext(DialogContext);
  if (!context) throw new Error('DialogContent must be used within Dialog');

  const contentRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    containerRef: contentRef,
    isActive: context.open,
    initialFocus,
    onEscape: () => context.setOpen(false),
  });

  if (!context.open) return null;

  return (
    <DialogPortal>
      <DialogOverlay onClick={() => context.setOpen(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy ?? context.titleId}
          tabIndex={-1}
          className={cn(
            'relative w-full max-w-lg rounded-xl border bg-card p-6 text-card-foreground shadow-lg outline-none transition-all duration-150 ease-out sm:rounded-2xl',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {children}
          {showCloseButton && (
            <button
              type="button"
              aria-label="Cerrar diálogo"
              onClick={() => context.setOpen(false)}
              className="absolute top-4 right-4 flex size-12 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97]"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
      </div>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3',
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({ className, id, ...props }: ComponentProps<'h2'>) {
  const context = useContext(DialogContext);
  return (
    <h2
      id={id ?? context?.titleId}
      className={cn('font-display text-xl font-bold tracking-tight', className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
