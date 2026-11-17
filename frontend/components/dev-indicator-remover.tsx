'use client';

import { useEffect } from 'react';

export function DevIndicatorRemover() {
  useEffect(() => {
    // Remove Next.js dev indicator on mount and continuously
    const removeIndicator = () => {
      const selectors = [
        '#__next-build-watcher',
        '.__next-build-watcher',
        '[data-nextjs-scroll-focus-boundary]',
        '.__next-dev-overlay',
        '[class*="nextjs"]',
        'nextjs-portal',
      ];

      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          (el as HTMLElement).style.display = 'none';
          (el as HTMLElement).style.visibility = 'hidden';
          (el as HTMLElement).style.opacity = '0';
          (el as HTMLElement).style.pointerEvents = 'none';
          (el as HTMLElement).remove();
        });
      });
    };

    // Run immediately
    removeIndicator();

    // Run on interval
    const interval = setInterval(removeIndicator, 100);

    return () => clearInterval(interval);
  }, []);

  return null;
}
