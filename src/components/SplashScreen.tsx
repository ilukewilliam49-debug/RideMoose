import { motion, AnimatePresence } from "framer-motion";
import logoImg from "@/assets/logo.png";

interface SplashScreenProps {
  visible: boolean;
}

const SplashScreen = ({ visible }: SplashScreenProps) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-col items-center gap-4"
        >
          <img
            src={logoImg}
            alt="PickYou"
            className="h-20 rounded-xl bg-white px-4 py-2 object-contain"
          />
          <div className="flex gap-1.5 mt-4">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full bg-primary"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
        <p className="absolute bottom-8 text-xs text-muted-foreground font-medium">
          Your Ride. Your Choice.
        </p>
      </motion.div>
    )}
  </AnimatePresence>
);

export default SplashScreen;
