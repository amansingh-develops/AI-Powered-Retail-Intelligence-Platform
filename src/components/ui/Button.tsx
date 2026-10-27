import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  className = "",
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs min-h-[28px]",
    md: "px-3.5 py-1.5 text-sm min-h-[34px]",
    lg: "px-4 py-2 text-sm min-h-[40px]",
  }[size];

  const variantClasses = {
    primary:
      "bg-[#3B3358] text-white hover:bg-[#2F2946] active:bg-[#231F35] border border-transparent shadow-none",
    secondary:
      "bg-white text-[#1B1B1F] border border-[#E3E1DC] hover:bg-[#F6F5F2] active:bg-[#EDEAF2]",
    danger:
      "bg-[#B23A2E] text-white hover:bg-[#962F24] border border-transparent",
    ghost:
      "bg-transparent text-[#6B6B72] hover:text-[#1B1B1F] hover:bg-[#EDEAF2] border border-transparent",
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center font-medium rounded-[5px] transition-colors focus-visible:outline-2 focus-visible:outline-[#3B3358] focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
