import { motion } from "framer-motion";
import { Check } from "lucide-react";

/**
 * Full-screen success moment shown for ~2s after the application is
 * submitted, before auto-routing to the pending review page.
 */
export const SubmittedSuccess = () => {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(180deg, hsl(220 30% 10%), hsl(220 30% 6%))" }}
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.05 }}
        className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 240, damping: 14 }}
        >
          <Check className="h-12 w-12 text-primary" strokeWidth={3} />
        </motion.div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.35 }}
        className="mt-6 text-2xl font-bold text-foreground text-center"
      >
        Application submitted!
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.35 }}
        className="mt-2 text-sm text-muted-foreground text-center max-w-xs"
      >
        We're reviewing now. Most drivers are approved within 24 hours.
      </motion.p>
    </div>
  );
};

export default SubmittedSuccess;
