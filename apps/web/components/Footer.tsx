"use client";

import React from "react";
import Link from "next/link";
import { FaXTwitter } from "react-icons/fa6";
import { FaGithub, FaLinkedin, FaDiscord } from "react-icons/fa";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-[#101010] backdrop-blur-lg text-gray-300 py-2 md:py-8 mt-auto">
      <div className="max-w-6xl mx-auto px-6 md:px-4 flex flex-col md:flex-row justify-between items-center md:gap-8 gap-6">
        {/* Left: Branding & Copyright */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <Link
            href="/"
            className="text-lg font-bold text-white hover:text-blue-400 transition-colors duration-200"
          >
            El Meet
          </Link>
          <p className="text-xs mt-1 text-gray-400">
            &copy; {currentYear} El Meet. All rights reserved.
          </p>
        </div>

        {/* Center: Social Links */}
        <div className="flex items-center gap-6">
          <a
            href="https://x.com/iamdeepakpatnkr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-400 transition-colors duration-200"
            aria-label="X"
          >
            <FaXTwitter size={20} />
          </a>
          <a
            href="https://github.com/Deepakpatankar07"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-400 transition-colors duration-200"
            aria-label="GitHub"
          >
            <FaGithub size={22} />
          </a>
          <a
            href="https://www.linkedin.com/in/deepak-patankar"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-400 transition-colors duration-200"
            aria-label="LinkedIn"
          >
            <FaLinkedin size={22} />
          </a>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-400 transition-colors duration-200"
            aria-label="Discord"
          >
            <FaDiscord size={24} />
          </a>
        </div>

        {/* Right: Contact Info */}
        <div className="flex flex-col items-center md:items-end text-center md:text-right">
          <p className="text-sm">
            <a
              href="mailto:support@elmeet.com"
              className="hover:text-blue-400 transition-colors duration-200"
            >
              support@elmeet.com
            </a>
          </p>
          <p className="text-xs mt-1 text-gray-400">
            Join our{" "}
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-blue-400 transition-colors duration-200"
            >
              community
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;