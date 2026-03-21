import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"
import {Loader2} from "lucide-react";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
    {
      variants: {
        variant: {
          default:
              "bg-accent text-accent-foreground shadow-lg shadow-accent/20 hover:bg-accent/90",
          destructive:
              "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
          outline:
              "border border-white/10 bg-white/5 text-white shadow-sm hover:bg-white/10 hover:border-white/20",
          secondary:
              "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
          ghost:
              "hover:bg-white/10 text-white/70 hover:text-white",
          link:
              "text-accent underline-offset-4 hover:underline",
        },
        size: {
          default: "h-10 px-6",
          sm: "h-9 px-4 text-sm",
          lg: "h-11 px-8 text-base",
          icon: "h-10 w-10",
        },
      },
      defaultVariants: {
        variant: "default",
        size: "default",
      },
    }
)

const Button = React.forwardRef(({children, className, variant, size, asChild = false, isLoading= false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} >
      {isLoading && <Loader2 className="animate-spin" />}
      {children}
    </Comp>)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
