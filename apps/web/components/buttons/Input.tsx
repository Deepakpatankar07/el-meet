"use client";

export const Input = ({label, placeholder, onChange, type = "text"}: {
    label: string;
    placeholder: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: "text" | "password"
}) => {
    return <div className="grid gap-1">
        <div className="text-sm flex gap-1">
            <span className="pt-0.5">*</span>
            <label>{label}</label>
        </div>
        <div className="pb-4">
        <input className="border rounded px-4 py-2 w-full border-black bg-zinc-900 placeholder:text-white/10 placeholder:text-sm" type={type} placeholder={placeholder} onChange={onChange} />
        </div>
    </div>
}