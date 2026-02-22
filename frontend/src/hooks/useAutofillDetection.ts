import { useEffect, useRef, useState } from "react";

/**
 * Detects browser autofill (password managers) and optionally auto-submits the form.
 *
 * Usage:
 *   const { autoDetected } = useAutofillDetection(formRef, onAutoSubmit);
 *
 * The hook listens for the `animationstart` event on inputs with the
 * `:-webkit-autofill` pseudo-class (triggered by a CSS @keyframes rule).
 * After detecting 2+ autofilled inputs, it waits 1.5s then calls onAutoSubmit.
 */
export function useAutofillDetection(
  formRef: React.RefObject<HTMLFormElement | null>,
  onAutoSubmit: () => void,
) {
  const [autoDetected, setAutoDetected] = useState(false);
  const filledCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const handleAnimationStart = (e: AnimationEvent) => {
      if (e.animationName === "onAutoFillStart") {
        filledCount.current += 1;
        if (filledCount.current >= 2 && !timerRef.current) {
          setAutoDetected(true);
          timerRef.current = setTimeout(() => {
            onAutoSubmit();
          }, 1500);
        }
      }
    };

    form.addEventListener("animationstart", handleAnimationStart as EventListener, true);

    // Fallback: poll for autofilled inputs (some browsers don't fire animation events)
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      pollCount++;
      if (pollCount > 6) {
        clearInterval(pollInterval);
        return;
      }
      const inputs = form.querySelectorAll("input:-webkit-autofill");
      if (inputs.length >= 2 && !timerRef.current) {
        filledCount.current = inputs.length;
        setAutoDetected(true);
        timerRef.current = setTimeout(() => {
          onAutoSubmit();
        }, 1500);
        clearInterval(pollInterval);
      }
    }, 500);

    return () => {
      form.removeEventListener("animationstart", handleAnimationStart as EventListener, true);
      clearInterval(pollInterval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [formRef, onAutoSubmit]);

  return { autoDetected };
}

export default useAutofillDetection;
