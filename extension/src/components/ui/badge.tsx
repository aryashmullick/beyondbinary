import * as React from "react";
import { cn } from "@/lib/utils";

const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    variant?: "default" | "success" | "warning" | "danger" | "outline";
  }
>(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "bg-wit-primary text-white",
    success: "bg-wit-success text-white",
    warning: "bg-wit-accent text-wit-text",
    danger: "bg-wit-danger text-white",
    outline: "border-2 border-wit-border text-wit-text bg-transparent",
  };

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-wit-full px-2.5 py-0.5 text-xs font-display font-medium transition-colors",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
});
Badge.displayName = "Badge";

export { Badge };
