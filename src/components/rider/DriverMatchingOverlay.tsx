import { motion, AnimatePresence } from "framer-motion";
import { Car } from "lucide-react";

interface DriverMatchingOverlayProps {
  visible: boolean;
}

const DriverMatchingOverlay = ({ visible }: DriverMatchingOverlayProps) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="flex flex-col items-center gap-6 rounded-3xl border border-border/50 bg-card p-10 shadow-xl"
        >
          {/* Radar ripple rings */}
          <div className="relative flex h-24 w-24 items-center justify-center">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                initial={{ scale: 0.5, opacity: 0.7 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.6,
                  ease: "easeOut",
                }}
              />
            ))}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15"
            >
              <Car className="h-7 w-7 text-primary" />
            </motion.div>
          </div>

          <div className="space-y-1 text-center">
            <h3 className="text-lg font-semibold">Finding your driver…</h3>
            <p className="text-sm text-muted-foreground">
              Matching you with the nearest available driver
            </p>
          </div>

          {/* Animated dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full bg-primary"
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default DriverMatchingOverlay;
