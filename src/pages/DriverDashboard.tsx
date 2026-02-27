import DashboardHome from "./DashboardHome";
import DriverEarningsSummary from "@/components/DriverEarningsSummary";
import { useAuth } from "@/hooks/useAuth";

const DriverDashboard = () => {
  const { profile } = useAuth();

  if (profile?.role !== "driver") return <DashboardHome />;

  return (
    <div className="space-y-6">
      <DashboardHome />
      <DriverEarningsSummary />
    </div>
  );
};

export default DriverDashboard;
