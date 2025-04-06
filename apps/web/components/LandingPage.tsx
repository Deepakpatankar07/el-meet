"use client";

import { useState } from "react";
import GradientButton from "./buttons/GradientButton";
import NavPage from "./NavPage";
import Modal from "./Modal";
import Footer from "./Footer";

const LandingPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAction, setIsAction] = useState<"create" | "join">("create");

  return (
    <div className="min-h-screen h-full w-full bg-background/50 backdrop-blur-md text-white flex flex-col items-center justify-start">
      {/* Navbar */}
      <NavPage />
      {/* Hero Section */}
      <div className="bg-zinc-800/20 backdrop-blur-sm pt-[38px] pb-[43px] w-full" />
      <main className="text-center h-[60vh] md:h-[90vh] flex flex-col items-center justify-center px-12">
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold select-none pointer-events-none">
          Free Online Meeting <br /> Platform for{" "}
          <span className="text-blue-500">Everyone</span>
        </h1>
        <p className="text-gray-400 mt-4 md:max-w-xl max-w-sm mx-auto md:text-base text-xs select-none pointer-events-none">
          Nowadays you can collaborate with people all over the world, use our
          product for a feature-rich collaboration experience and {`it's`} also
          free.
        </p>
        <div className="mt-10 flex items-center gap-4">
          {/* Small Button for < md screens */}
          <div className="flex items-center gap-4 md:hidden">
            <GradientButton
              size="medium"
              onClick={() => {
                setIsModalOpen(true);
                setIsAction("create");
              }}
            >
              <span className="text-white text-xs font-medium">
                Create Meeting
              </span>
            </GradientButton>
            <GradientButton
              size="medium"
              onClick={() => {
                setIsModalOpen(true);
                setIsAction("join");
              }}
            >
              <span className="text-white text-xs font-medium">
                Join Meeting
              </span>
            </GradientButton>
          </div>

          {/* Big Button for >= md screens */}
          <div className="hidden md:flex gap-6">
            <GradientButton
              size="big"
              onClick={() => {
                setIsModalOpen(true);
                setIsAction("create");
              }}
            >
              <span className="text-white text-lg font-medium">
                Create Meeting
              </span>
            </GradientButton>
            <GradientButton
              size="big"
              onClick={() => {
                setIsModalOpen(true);
                setIsAction("join");
              }}
            >
              <span className="text-white text-lg font-medium">
                Join Meeting
              </span>
            </GradientButton>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Modal */}
      {isModalOpen && (
        <Modal isAction={isAction} onSelect={() => setIsModalOpen(false)} />
      )}
    </div>
  );
};

export default LandingPage;
