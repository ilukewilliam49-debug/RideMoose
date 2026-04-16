import { motion } from "framer-motion";
import { UserPlus, Upload, ShieldCheck, Car } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Apply online",
    desc: "Create your account in under 2 minutes — no paperwork required to start.",
  },
  {
    icon: Upload,
    title: "Upload documents",
    desc: "Snap photos of your driver's license, vehicle registration, and insurance.",
  },
  {
    icon: ShieldCheck,
    title: "Get approved",
    desc: "Our local team reviews your application within 24 hours on business days.",
  },
  {
    icon: Car,
    title: "Start earning",
    desc: "Go online, accept your first ride, and get paid weekly to your bank account.",
  },
];

const DriveHowItWorks = () => {
  return (
    <section id="how-it-works" className="border-b border-border/30">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-2">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">From signup to first ride in 4 steps</h2>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="relative rounded-2xl bg-card/60 ring-1 ring-border/30 p-6 hover:ring-primary/30 transition-all"
            >
              <div className="absolute -top-3 -right-3 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-black ring-4 ring-background">
                {idx + 1}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                <step.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-base font-bold mb-1.5">{step.title}</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DriveHowItWorks;
