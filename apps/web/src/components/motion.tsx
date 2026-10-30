'use client';

/**
 * Motion primitives (motion/react). Patterns follow the installed `motion-framer` and
 * `animated-component-libraries` skills: purposeful, short, GPU-friendly (opacity/transform)
 * and automatically disabled for users who prefer reduced motion (see <MotionConfig> in Providers).
 */
import { useEffect, useRef } from 'react';
import { animate, motion, useInView, useReducedMotion, type HTMLMotionProps, type Variants } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1] as const;

export function FadeIn({ delay = 0, y = 8, ...props }: HTMLMotionProps<'div'> & { delay?: number; y?: number }) {
  return <motion.div initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE, delay }} {...props} />;
}

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.045 } } };
const item: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } } };

/** Staggered reveal for grids of cards. Children should be <StaggerItem>. */
export function Stagger(props: HTMLMotionProps<'div'>) {
  return <motion.div variants={container} initial="hidden" animate="show" {...props} />;
}

export function StaggerItem(props: HTMLMotionProps<'div'>) {
  return <motion.div variants={item} {...props} />;
}

/**
 * Counts up to `value` when scrolled into view (Magic UI "NumberTicker" pattern).
 * The final, exact value is always rendered for screen readers and reduced-motion users.
 */
export function NumberTicker({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const previous = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce || !inView) {
      node.textContent = format(value);
      return;
    }
    const controls = animate(previous.current, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (latest) => {
        node.textContent = format(Number.isInteger(value) ? Math.round(latest) : Math.round(latest * 10) / 10);
      },
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, inView, reduce, format]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden>
        {format(value)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
