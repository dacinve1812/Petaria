import React, { useEffect, useState, useRef } from 'react';
import './SimpleFlashOverlay.css';

function SimpleFlashOverlay({ 
  isActive, 
  onAnimationComplete,
  flashCount = 3,
  duration = 800
 }) {
  const [currentFlash, setCurrentFlash] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const isRunningRef = useRef(false); // Prevent duplicate execution

  useEffect(() => {
    if (isActive && !isRunningRef.current) {
      isRunningRef.current = true; // Mark as running
      setCurrentFlash(0);
      setIsVisible(true);
      
      // Flash sequence: 3 lần screen đen thực sự
      // Pattern: 0 → 1 → 0 → 1 → 0 → 1 → 0 (6 transitions)
      const flashInterval = setInterval(() => {
        setCurrentFlash(prev => {
          const nextFlash = prev + 1;
          
          if (nextFlash >= 6) { // 6 flash states (0-5)
            // Flash cuối cùng xong, dừng và gọi callback
            clearInterval(flashInterval);
            setTimeout(() => {
              setIsVisible(false);
              if (onAnimationComplete) {
                onAnimationComplete();
              }
              isRunningRef.current = false; // Reset running flag
            }, 200); // Delay 0.3s trước khi ẩn và gọi callback
            return prev;
          }
          return nextFlash;
        });
      }, duration / 6); // Chia đều thời gian cho 6 flash states

      return () => {
        clearInterval(flashInterval);
        isRunningRef.current = false; // Reset running flag
      };
    }
  }, [isActive, onAnimationComplete, flashCount, duration]);

  if (!isActive) return null;

  const flashClass = `flash-overlay flash-${currentFlash}`;

  return (
    <div 
      id="flashOverlay"
      className={flashClass}
    />
  );
}

export default SimpleFlashOverlay;
