"use client";

import Link from "next/link";
import { PrimaryButton } from "./buttons/PrimaryButton";
import Logo from "./Logo";

const NavPage = () => {
  return (
    <>
      {/* Navbar */}
      <header className="w-full grid grid-cols-3 items-center px-12 py-6 bg-black/30 backdrop-blur-lg fixed top-0 left-0 right-0 z-50">
        {/* Logo Section */}
        <Logo />

        {/* Navigation (Centered) */}
        <nav className="hidden md:flex gap-8 text-gray-300 justify-center items-center">
          <Link href="#" className="hover:text-white transition">Home</Link>
          <Link href="#" className="hover:text-white transition">Product</Link>
          <Link href="#" className="hover:text-white transition">Features</Link>
          <Link href="#" className="hover:text-white transition">Pricing</Link>
        </nav>

        {/* Buttons (Right-Aligned) */}
        <div className="flex justify-end gap-4">
          <PrimaryButton>
            Login
          </PrimaryButton>
          <PrimaryButton className="bg-blue-500 hover:bg-blue-400 transition">
            Sign up
          </PrimaryButton>
        </div>
      </header>

    </>
  );
};

export default NavPage;
