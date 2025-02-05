import { ReactNode } from "react"

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  size?: "small" | "medium" | "big";
  className?: string;
}

export const PrimaryButton = ({ children, onClick, size = "small" ,className="bg-transparent"}: PrimaryButtonProps) => {
  const sizeClasses: Record<"small" | "medium" | "big", string> = {
    small: "text-sm px-6 py-2",
    medium: "text-xl px-10 py-3",
    big: "text-2xl px-14 py-4",
  };

  return (
    <div
      onClick={onClick}
      className={` cursor-pointer hover:shadow-md transition text-white rounded-full border border-gray-500 text-center flex justify-center items-center
        ${sizeClasses[size]} ${className}`}
    >
      {children}
    </div>
  );
};
