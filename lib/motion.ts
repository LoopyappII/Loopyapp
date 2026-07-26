import type { Transition, Variants } from "framer-motion";

export const easeOut: Transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] };

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: easeOut },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: easeOut },
};

export const staggerContainer = (stagger = 0.12, delayChildren = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

// Para animaciones "al hacer scroll": una sola vez, un poco antes de entrar en viewport.
export const revealOnce = { once: true, margin: "-80px" };
