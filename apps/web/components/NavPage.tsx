"use client";

import Link from "next/link";
import { PrimaryButton } from "./buttons/PrimaryButton";
import Logo from "./Logo";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useEffect, useState } from "react";
import { useAppContext } from "@/context/AppContext";

const NavPage = () => {
  const router = useRouter();
  const { token, setToken } = useAppContext();

  const handleLogOut = () => {
    setToken(null);
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <header className="w-full grid md:grid-cols-3 grid-cols-2 items-center px-12 py-6 bg-black/30 backdrop-blur-lg fixed top-0 left-0 right-0 z-50">
      <Logo />

      <nav className="hidden md:flex gap-8 text-gray-300 justify-center items-center">
        <Link href="/" className="hover:text-white transition">Home</Link>
        <Link href="#" className="hover:text-white transition">Product</Link>
        <Link href="#" className="hover:text-white transition">Features</Link>
        <Link href="#" className="hover:text-white transition">Pricing</Link>
      </nav>

      <div className="flex justify-end">
        {token ? (
          <PrimaryButton onClick={handleLogOut} className="hover:bg-white/10 transition">
            Logout
          </PrimaryButton>
        ) : (
          <div className="flex items-center gap-4">
            <PrimaryButton onClick={() => router.push("/login")} className="hover:bg-white/10 transition">
              Login
            </PrimaryButton>
            <PrimaryButton onClick={() => router.push("/signup")} className="hover:bg-white/10 transition">
              Sign up
            </PrimaryButton>
          </div>
        )}
      </div>
    </header>
  );
};

export default NavPage;
