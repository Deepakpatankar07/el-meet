"use client";

import { useState } from "react";
import GradientButton from "./buttons/GradientButton";
import NavPage from "./NavPage";
import Modal from "./Modal";

const LandingPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-background/50 backdrop-blur-md text-white flex flex-col items-center justify-start">
      {/* Navbar */}
      <NavPage />
      {/* Hero Section */}
      <div className="bg-zinc-800/20 backdrop-blur-sm py-[43px] w-full"/>
      <main className="text-center mt-12 flex flex-col items-center justify-center px-12">
        <h1 className="text-4xl md:text-6xl font-bold">
          Free Online Meeting <br /> Platform for{" "}
          <span className="text-blue-500">Everyone</span>
        </h1>
        <p className="text-gray-400 mt-4 max-w-xl mx-auto">
          Nowadays you can collaborate with people all over the world, use our product for a feature-rich collaboration experience and it's also free.
        </p>
        <div className="mt-10">
          <GradientButton size="big" onClick={() => setIsModalOpen(true)}>
            <span className="text-white text-lg font-medium">Create Meet</span>
          </GradientButton>
        </div>
      </main>
      
      {/* Modal */}
      {isModalOpen && <Modal onSelect={() => setIsModalOpen(false)} />}
    </div>
  );
};

export default LandingPage;
