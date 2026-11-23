import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes } from 'react'
const variants = cva(
  'cf-button inline-flex items-center justify-center disabled:pointer-events-none disabled:opacity-50',
)
export function Button({
  asChild = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(variants(), className)} {...props} />
}
