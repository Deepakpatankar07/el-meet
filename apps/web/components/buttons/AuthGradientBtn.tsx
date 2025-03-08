"use client";
import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  size?: "small" | "medium" | "big";
}

export const AuthGradientBtn = ({ children, onClick, size = "small"}: ButtonProps) => {
  const sizeClasses: Record<"small" | "medium" | "big", string> = {
    small: "text-sm px-6 py-2",
    medium: "text-xl px-10 py-3",
    big: "text-2xl px-16 py-4",
  };
  return (
    <div
      onClick={onClick}
      className={`inline-flex cursor-pointer hover:shadow-md text-white w-full outline-none`}
    >
      <div className={`w-full relative inline-flex items-center justify-center px-[1px] py-[1px] rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 outline-none`}>
        <button className={`relative flex items-center justify-center w-full h-full ${sizeClasses[size]} font-semibold text-white transition-all duration-300 bg-background rounded-full outline-none`}>
          {children}
        </button>
      </div>
    </div>
  );
};

export default AuthGradientBtn;
