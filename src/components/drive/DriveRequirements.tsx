import { motion } from "framer-motion";
import { Check, Car, IdCard, ShieldCheck, Smartphone, FileText, MapPin } from "lucide-react";

const requirements = [
  { icon: IdCard, text: "Valid driver's license issued more than 1 year ago" },
  { icon: Car, text: "Vehicle in good condition (2010 or newer recommended)" },
  { icon: FileText, text: "Vehicle registration and current insurance" },
  { icon: ShieldCheck, text: "Clean driving record and no major violations" },
  { icon: Smartphone, text: "Smartphone with data plan (iPhone or Android)" },
  { icon: MapPin, text: "Eligible to work in Canada and based in Yellowknife area" },
];

const DriveRequirements = () => {
  return (
    <section className="border-b border-border/30 bg-card/20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="text-center max-w-2xl mx-auto mb-10"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-2">
            Requirements
          </p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">What you need to drive</h2>
          <p className="mt-3 text-[15px] text-muted-foreground">
            Make sure you meet these basics before you apply.
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto grid gap-3 sm:grid-cols-2">
          {requirements.map((req, idx) => (
            <motion.div
              key={req.text}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="flex items-start gap-3 rounded-xl bg-card/60 ring-1 ring-border/30 p-4"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm leading-snug pt-1">{req.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DriveRequirements;
