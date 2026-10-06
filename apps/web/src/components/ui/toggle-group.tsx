import { cva, type VariantProps } from 'class-variance-authority';
import {
  createContext,
  useContext,
  type ComponentProps,
  type KeyboardEvent,
} from 'react';
import { cn } from '@/lib/utils';

const toggleGroupVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-[color,background-color,transform] duration-150 ease-out select-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
  {
    variants: {
      variant: {
        default:
          'bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
        outline:
          'border border-input bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
      },
      size: {
        default: 'h-12 px-4 min-h-[48px]',
        sm: 'h-11 px-3 min-h-[44px]',
        lg: 'h-14 px-6 min-h-[56px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ToggleGroupType = 'single' | 'multiple';

interface ToggleGroupContextValue {
  type: ToggleGroupType;
  value: string | string[];
  onItemSelect: (itemValue: string) => void;
  variant?: VariantProps<typeof toggleGroupVariants>['variant'];
  size?: VariantProps<typeof toggleGroupVariants>['size'];
  orientation?: 'horizontal' | 'vertical';
}

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

interface ToggleGroupBaseProps extends Omit<ComponentProps<'div'>, 'onChange'> {
  variant?: VariantProps<typeof toggleGroupVariants>['variant'];
  size?: VariantProps<typeof toggleGroupVariants>['size'];
  orientation?: 'horizontal' | 'vertical';
}

export interface ToggleGroupSingleProps extends ToggleGroupBaseProps {
  type?: 'single';
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export interface ToggleGroupMultipleProps extends ToggleGroupBaseProps {
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

export type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

export function ToggleGroup(props: ToggleGroupProps) {
  const {
    type = 'single',
    value: controlledValue,
    defaultValue,
    variant = 'default',
    size = 'default',
    orientation = 'horizontal',
    className,
    children,
    ...restProps
  } = props;

  const isControlled = controlledValue !== undefined;
  const initialValue =
    controlledValue ?? defaultValue ?? (type === 'multiple' ? [] : '');

  const currentValue = isControlled ? controlledValue : initialValue;

  const handleItemSelect = (itemValue: string) => {
    if (props.type === 'multiple') {
      const currentList = Array.isArray(currentValue) ? currentValue : [];
      const nextList = currentList.includes(itemValue)
        ? currentList.filter((v) => v !== itemValue)
        : [...currentList, itemValue];
      props.onValueChange?.(nextList);
    } else {
      const nextValue = currentValue === itemValue ? '' : itemValue;
      props.onValueChange?.(nextValue);
    }
  };

  return (
    <ToggleGroupContext.Provider
      value={{
        type,
        value: currentValue,
        onItemSelect: handleItemSelect,
        variant,
        size,
        orientation,
      }}
    >
      <div
        role={type === 'single' ? 'radiogroup' : 'group'}
        aria-orientation={orientation}
        className={cn(
          'flex gap-1',
          orientation === 'vertical' ? 'flex-col' : 'flex-row',
          className,
        )}
        {...restProps}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

export interface ToggleGroupItemProps
  extends ComponentProps<'button'>,
    VariantProps<typeof toggleGroupVariants> {
  value: string;
}

export function ToggleGroupItem({
  value,
  className,
  children,
  variant: itemVariant,
  size: itemSize,
  disabled,
  ...props
}: ToggleGroupItemProps) {
  const context = useContext(ToggleGroupContext);

  if (!context) {
    throw new Error('ToggleGroupItem must be used within a ToggleGroup');
  }

  const isSelected =
    context.type === 'single'
      ? context.value === value
      : Array.isArray(context.value) && context.value.includes(value);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      context.onItemSelect(value);
    }
  };

  return (
    <button
      type="button"
      role={context.type === 'single' ? 'radio' : 'button'}
      aria-checked={context.type === 'single' ? isSelected : undefined}
      aria-pressed={context.type === 'multiple' ? isSelected : undefined}
      data-state={isSelected ? 'on' : 'off'}
      disabled={disabled}
      onClick={() => context.onItemSelect(value)}
      onKeyDown={handleKeyDown}
      className={cn(
        toggleGroupVariants({
          variant: itemVariant ?? context.variant,
          size: itemSize ?? context.size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { toggleGroupVariants };
