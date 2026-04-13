import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Car, Plane, Package, UtensilsCrossed, PawPrint } from "lucide-react";

const services = [
  { icon: Car, key: "taxi", labelKey: "landing.serviceTaxiTitle", descKey: "landing.serviceTaxiDesc" },
  { icon: Plane, key: "airport", labelKey: "landing.serviceAirportTitle", descKey: "landing.serviceAirportDesc" },
  { icon: Package, key: "courier", labelKey: "landing.serviceCourierTitle", descKey: "landing.serviceCourierDesc" },
  { icon: UtensilsCrossed, key: "food", labelKey: "nav.foodDelivery", descKey: "landing.serviceCourierDesc" },
  { icon: PawPrint, key: "pet", labelKey: "rider.petTransport", descKey: "rider.petWithOwnerDesc" },
];

const LandingServices = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section className="border-t border-border/30 px-5 lg:px-8 py-14 md:py-20">
      <div className="mx-auto max-w-7xl">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-2xl font-black tracking-tight md:text-4xl mb-8"
        >
          Explore what you can do
        </motion.h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => (
            <motion.button
              key={service.key}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              onClick={() => navigate("/login")}
              className="group flex items-start gap-4 rounded-2xl bg-card p-6 text-left ring-1 ring-border/30 transition-all hover:ring-primary/30 hover:bg-card/80"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <service.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <h3 className="text-[15px] font-bold leading-tight">{t(service.labelKey)}</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
                  {t(service.descKey)}
                </p>
                <span className="inline-block text-xs font-semibold text-primary group-hover:underline mt-1">
                  Details
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingServices;
