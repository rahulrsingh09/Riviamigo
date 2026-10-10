import React from 'react';
import './r-experience.css';

export function RExperienceRoot({ children }: { children: React.ReactNode }) {
  React.useLayoutEffect(() => {
    const body = document.body;
    body.classList.add('r-experience');
    document.documentElement.classList.add('r-interface');
    const pointer = () => { body.dataset.inputMode = 'pointer'; };
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target;
      if (!event.metaKey && !event.ctrlKey && !event.altKey
        && (event.key === 'Tab' || !(target instanceof Element && target.closest('input,textarea,[contenteditable]')))) {
        body.dataset.inputMode = 'keyboard';
      }
    };
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('keydown', keyboard, true);
    return () => {
      body.classList.remove('r-experience');
      document.documentElement.classList.remove('r-interface');
      delete body.dataset.inputMode;
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('keydown', keyboard, true);
    };
  }, []);
  return <>{children}</>;
}
