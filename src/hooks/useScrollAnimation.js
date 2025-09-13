import { useState, useEffect } from 'react';

const useScrollAnimation = (threshold = 0) => {
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Check if scrolled down past threshold
      if (currentScrollY > threshold) {
        // Determine scroll direction
        if (currentScrollY > lastScrollY) {
          // Scrolling down
          setIsScrolledDown(true);
        } else {
          // Scrolling up
          setIsScrolledDown(false);
        }
      } else {
        // Below threshold, always show navs
        setIsScrolledDown(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    // Throttle scroll event for better performance
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledHandleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
    };
  }, [lastScrollY, threshold]);

  return isScrolledDown;
};

export default useScrollAnimation;
