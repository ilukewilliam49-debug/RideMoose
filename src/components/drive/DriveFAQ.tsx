import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "How much can I earn driving for PickYou?",
    a: "Most active drivers in Yellowknife earn between $800 and $1,500 per week, depending on hours, time of day, and services offered. Drivers who work peak hours (Friday/Saturday nights, weekday rush) and accept multiple service types (taxi, courier, delivery) typically earn the most.",
  },
  {
    q: "When and how do I get paid?",
    a: "Payouts are processed weekly directly to your bank account. You'll see your real-time earnings in the Driver app and can track every fare, tip, and commission deduction transparently.",
  },
  {
    q: "How long does the approval process take?",
    a: "Most applications are reviewed within 24 hours on business days. Once approved, you can go online and start accepting rides immediately — no waiting period, no orientation required.",
  },
  {
    q: "What documents do I need to upload?",
    a: "You'll need a clear photo of your valid driver's license (front and back), your vehicle registration, and your current proof of insurance. If you plan to drive taxi service in Yellowknife, you'll also need a Chauffeur's Permit.",
  },
  {
    q: "Can I drive part-time or only on weekends?",
    a: "Absolutely. PickYou is built for flexibility — there are no minimum hours, no quotas, and no schedule. Go online when you want to drive, and go offline when you're done. Many of our drivers work just evenings or weekends.",
  },
  {
    q: "How does commission work?",
    a: "PickYou keeps just 4.9% commission on standard rides — one of the lowest rates in Canada. That means you keep 95.1% of every fare plus 100% of all tips. Specialized services (large item, retail) have slightly different rates clearly listed in your app.",
  },
  {
    q: "Do I need my own vehicle?",
    a: "Yes, you need access to a vehicle that meets our requirements (good condition, properly insured and registered). The vehicle does not have to be in your name, but you must be listed on the insurance policy.",
  },
  {
    q: "Is there support if I have a problem?",
    a: "Yes. PickYou is locally operated in Yellowknife with in-app support, a phone line, and a real human team that responds quickly to driver questions and concerns.",
  },
];

const DriveFAQ = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="border-b border-border/30">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="text-center max-w-2xl mx-auto mb-10"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-2">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">Frequently asked questions</h2>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-2.5">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={faq.q}
                className="rounded-2xl bg-card/60 ring-1 ring-border/30 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-card/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-expanded={isOpen}
                >
                  <span className="text-[15px] font-bold leading-snug">{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180 text-primary",
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-[14px] leading-relaxed text-muted-foreground">{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default DriveFAQ;
