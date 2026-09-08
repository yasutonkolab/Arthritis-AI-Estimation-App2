import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => {
    const variants = {
      primary:
        "bg-primary text-primary-foreground enabled:hover:bg-primary-hover disabled:bg-disabled disabled:text-disabled-foreground",
      secondary:
        "bg-surface text-secondary-foreground border border-border-strong enabled:hover:bg-surface-hover disabled:border-border disabled:text-subtle-foreground",
      danger:
        "bg-danger-solid text-danger-solid-foreground enabled:hover:bg-danger-solid-hover disabled:bg-disabled disabled:text-disabled-foreground",
      ghost: "text-secondary-foreground enabled:hover:bg-surface-hover disabled:text-subtle-foreground",
    };
    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2",
      lg: "px-6 py-3 text-lg",
    };

    return (
      <button
        ref={ref}
        className={`rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export default Button;
