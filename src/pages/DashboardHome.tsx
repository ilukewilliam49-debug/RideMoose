import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Car, MapPin, DollarSign, Clock } from "lucide-react";

const DashboardHome = () => {
  const { profile } = useAuth();

  const greeting = profile?.full_name ? `Welcome, ${profile.full_name}` : "Welcome";

  const stats = {
    rider: [
      { icon: Car, label: "Total Rides", value: "—" },
      { icon: DollarSign, label: "Total Spent", value: "—" },
      { icon: Clock, label: "Avg Wait", value: "—" },
    ],
    driver: [
      { icon: Car, label: "Trips Completed", value: "—" },
      { icon: DollarSign, label: "Earnings", value: "—" },
      { icon: Clock, label: "Hours Online", value: "—" },
    ],
    admin: [
      { icon: Car, label: "Active Rides", value: "—" },
      { icon: MapPin, label: "Online Drivers", value: "—" },
      { icon: DollarSign, label: "Revenue Today", value: "—" },
    ],
  };

  const role = profile?.role || "rider";
  const cards = stats[role] || stats.rider;

  return (
    <div className="space-y-6 pt-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">{greeting}</h1>
        <p className="text-muted-foreground text-sm mt-1">Here's your overview</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-surface rounded-lg p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <card.icon className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-2xl font-bold font-mono">{card.value}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DashboardHome;
