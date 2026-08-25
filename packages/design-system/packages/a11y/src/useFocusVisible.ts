import { useState, useEffect } from 'react';

export function useFocusVisible(): boolean {
  const [isFocusVisible, setIsFocusVisible] = useState(false);

  useEffect(() => {
    let hadKeyboardEvent = false;

    const onPointerDown = () => {
      hadKeyboardEvent = false;
      setIsFocusVisible(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab' || event.key.startsWith('Arrow')) {
        hadKeyboardEvent = true;
      }
    };

    const onFocus = () => {
      if (hadKeyboardEvent) {
        setIsFocusVisible(true);
      }
    };

    const onBlur = () => {
      setIsFocusVisible(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
    };
  }, []);

  return isFocusVisible;
}
