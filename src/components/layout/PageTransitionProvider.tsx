'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export const PageTransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const progressBarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 1. Instant 0ms Mousedown/Click Feedback: When user clicks any link, immediately animate top bar
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (target && target.href && target.href.startsWith(window.location.origin) && !target.target && !e.ctrlKey && !e.metaKey) {
        if (progressBarRef.current) {
          progressBarRef.current.style.transition = 'none';
          progressBarRef.current.style.width = '25%';
          progressBarRef.current.style.opacity = '1';

          requestAnimationFrame(() => {
            if (progressBarRef.current) {
              progressBarRef.current.style.transition = 'width 0.25s ease-out';
              progressBarRef.current.style.width = '75%';
            }
          });
        }
      }
    };

    window.addEventListener('click', handleGlobalClick, { capture: true });
    return () => window.removeEventListener('click', handleGlobalClick, { capture: true });
  }, []);

  // 2. Route Change Completion: Finish top bar in 150ms and trigger smooth page entrance
  useEffect(() => {
    if (progressBarRef.current) {
      progressBarRef.current.style.transition = 'width 0.15s ease-out';
      progressBarRef.current.style.width = '100%';
      const timer = setTimeout(() => {
        if (progressBarRef.current) {
          progressBarRef.current.style.opacity = '0';
          setTimeout(() => {
            if (progressBarRef.current) progressBarRef.current.style.width = '0%';
          }, 150);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return (
    <>
      {/* Top glowing progress line for instant 0ms visual feedback */}
      <div
        ref={progressBarRef}
        aria-hidden="true"
        className="fixed top-0 left-0 h-[2.5px] z-[99999] pointer-events-none bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 shadow-[0_0_12px_rgba(249,115,22,0.8)]"
        style={{ width: '0%', opacity: 0 }}
      />

      {/* Persistent Page Container (No key={pathname} to prevent costly DOM teardown) */}
      <div
        ref={contentRef}
        className="flex-1 flex flex-col w-full"
      >
        {children}
      </div>
    </>
  );
};
