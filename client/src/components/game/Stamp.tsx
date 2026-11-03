import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/** The verdict stamps itself onto the card: pressed once, slightly crooked, like ink on a ticket. */
export function Stamp({ label, sub, className }: { label: string; sub?: string; className?: string }) {
  return (
    <motion.div
      initial={{ scale: 1.9, rotate: -18, opacity: 0 }}
      animate={{ scale: 1, rotate: -7, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 22, mass: 0.9, delay: 0.05 }}
      className={cn('inline-flex flex-col items-center rounded-2xl border-[3px] border-current px-4 py-2 text-center', className)}
      role="status"
    >
      <span className="text-[28px] font-[900] uppercase leading-none tracking-[0.08em]" style={{ fontStretch: '118%' }}>
        {label}
      </span>
      {sub && <span className="label-caps mt-1 text-[9px]">{sub}</span>}
    </motion.div>
  );
}
