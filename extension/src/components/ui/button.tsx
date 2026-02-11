import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default:
        "bg-wit-primary text-white hover:bg-wit-primary-hover shadow-wit",
      secondary: "bg-wit-secondary text-white hover:opacity-90",
      outline:
        "border-2 border-wit-border bg-transparent text-wit-text hover:bg-wit-surface",
      ghost: "text-wit-text hover:bg-wit-surface",
      destructive: "bg-wit-danger text-white hover:opacity-90",
    };
    const sizes = {
      default: "h-10 px-5 py-2 text-wit-base",
      sm: "h-8 px-3 py-1 text-wit-sm",
      lg: "h-12 px-6 py-3 text-wit-lg",
      icon: "h-10 w-10 p-0",
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-wit font-display font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wit-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
          variants[variant],
          sizes[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
