import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** Pills. `onCard` variants read the surrounding card's colors from CSS variables. */
const buttonVariants = cva(
  'label-caps inline-flex select-none items-center justify-center gap-2.5 whitespace-nowrap rounded-full transition-[transform,background-color,color,box-shadow,opacity] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[1.15em] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // White pill with the card's color as text: the primary action on a card.
        card: 'bg-[var(--on-card)] text-[var(--card)] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)] hover:shadow-[0_14px_28px_-12px_rgba(0,0,0,0.5)] hover:-translate-y-px',
        cardOutline: 'border-2 border-[var(--on-card)]/60 text-[var(--on-card)] hover:border-[var(--on-card)] hover:bg-[var(--card-field)]',
        cardGhost: 'text-[var(--on-card)]/80 hover:text-[var(--on-card)] hover:bg-[var(--card-field)]',
        ink: 'bg-ink text-paper hover:-translate-y-px hover:shadow-[0_12px_24px_-12px_rgba(27,26,23,0.6)]',
        outline: 'border-2 border-ink/25 text-ink hover:border-ink',
        ghost: 'text-ink-soft hover:text-ink hover:bg-paper-deep',
      },
      size: {
        sm: 'h-9 px-4 text-[11px]',
        md: 'h-12 px-6 text-xs',
        lg: 'h-14 px-8 text-[13px]',
        icon: 'size-12 rounded-full text-xs',
      },
    },
    defaultVariants: { variant: 'ink', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';

export { buttonVariants };
