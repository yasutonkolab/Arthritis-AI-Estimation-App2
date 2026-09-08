import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="mb-1 block text-sm font-medium text-secondary-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-foreground placeholder:text-subtle-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus ${className}`}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";

export default Input;
