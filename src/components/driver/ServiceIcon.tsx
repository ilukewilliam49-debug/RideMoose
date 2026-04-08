import { getServiceIcon } from "@/lib/driver-constants";

const ServiceIcon = ({ type, className = "h-4 w-4" }: { type: string; className?: string }) => {
  const Icon = getServiceIcon(type);
  return <Icon className={className} />;
};

export default ServiceIcon;
