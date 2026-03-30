import { useEffect, useRef, useState } from 'react';
import Lottie, { type LottieRefCurrentProps } from 'lottie-react';
import burgerMenu from '../../assets/burger-menu.json';

const MENU_LOTTIE_FALLBACK_END = Math.max(
  0,
  Math.floor((burgerMenu as { op?: number }).op ?? 100)
);
const MENU_LOTTIE_OPEN_FRAME = 67;
const MENU_LOTTIE_SPEED = 1.75;

interface BurgerButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export default function BurgerButton({ isOpen, onClick }: BurgerButtonProps) {
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);
  const [isReady, setIsReady] = useState(false);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const lottie = lottieRef.current;
    if (!lottie) {
      return;
    }

    const duration = lottie.getDuration(true);
    const endFrame =
      typeof duration === 'number' && Number.isFinite(duration) && duration > 0
        ? Math.max(0, Math.floor(duration))
        : MENU_LOTTIE_FALLBACK_END;
    const openFrame = Math.max(0, Math.min(MENU_LOTTIE_OPEN_FRAME, endFrame));
    const targetFrame = isOpen ? openFrame : 0;

    if (!hasMounted.current) {
      lottie.goToAndStop(targetFrame, true);
      hasMounted.current = true;
      return;
    }

    lottie.setSpeed(MENU_LOTTIE_SPEED);
    if (isOpen) {
      lottie.playSegments([0, openFrame], true);
      return;
    }

    lottie.playSegments([openFrame, 0], true);
  }, [isOpen, isReady]);

  return (
    <button
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/30 bg-[#1f1140]/80 transition hover:bg-[#2e185c]"
      aria-label="Toggle menu"
      title={isOpen ? 'Tutup sidebar' : 'Buka sidebar'}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={burgerMenu}
        autoplay={false}
        loop={false}
        onDOMLoaded={() => setIsReady(true)}
        className="pointer-events-none h-7 w-7 brightness-0 invert"
        aria-hidden="true"
      />
    </button>
  );
}
