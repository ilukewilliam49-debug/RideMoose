import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Save, Car, Briefcase, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables } from "@/integrations/supabase/types";

type ServicePricing = Tables<"service_pricing">;

const serviceConfig = {
  taxi: { label: "Taxi", icon: Car, color: "text-yellow-500" },
  private_hire: { label: "Private Hire", icon: Briefcase, color: "text-blue-500" },
  shuttle: { label: "Shuttle", icon: Bus, color: "text-green-500" },
} as const;

const AdminPricing = () => {
  const queryClient = useQueryClient();
  const [editState, setEditState] = useState<Record<string, Partial<ServicePricing>>>({});

  const { data: pricingRows, isLoading } = useQuery({
    queryKey: ["admin-service-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_pricing")
        .select("*")
        .order("service_type");
      if (error) throw error;
      return data as ServicePricing[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (row: ServicePricing) => {
      const { id, created_at, updated_at, ...updates } = row;
      const { error } = await supabase
        .from("service_pricing")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-service-pricing"] });
      toast.success("Pricing updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getEdited = (row: ServicePricing): ServicePricing => ({
    ...row,
    ...(editState[row.id] || {}),
  });

  const handleChange = (id: string, field: keyof ServicePricing, value: any) => {
    setEditState((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = (row: ServicePricing) => {
    const edited = getEdited(row);
    updateMutation.mutate(edited);
    setEditState((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
  };

  const isDirty = (id: string) => !!editState[id] && Object.keys(editState[id]).length > 0;

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading pricing…</div>;
  }

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-2xl font-bold">Service Pricing</h1>

      <div className="grid gap-6 md:grid-cols-3">
        {pricingRows?.map((row) => {
          const cfg = serviceConfig[row.service_type as keyof typeof serviceConfig];
          const edited = getEdited(row);
          const Icon = cfg?.icon || Car;

          return (
            <motion.div key={row.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className={`h-5 w-5 ${cfg?.color}`} />
                    {cfg?.label || row.service_type}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <NumField label="Base Fare ($)" value={edited.base_fare} onChange={(v) => handleChange(row.id, "base_fare", v)} />
                  <NumField label="Per KM Rate ($)" value={edited.per_km_rate} onChange={(v) => handleChange(row.id, "per_km_rate", v)} />
                  <NumField label="Per Min Rate ($)" value={edited.per_min_rate} onChange={(v) => handleChange(row.id, "per_min_rate", v)} />
                  <NumField label="Minimum Fare ($)" value={edited.minimum_fare} onChange={(v) => handleChange(row.id, "minimum_fare", v)} />
                  <NumField label="Surge Multiplier" value={edited.surge_multiplier} onChange={(v) => handleChange(row.id, "surge_multiplier", v)} />

                  <div className="flex items-center justify-between">
                    <Label>Flat Rate</Label>
                    <Switch
                      checked={edited.is_flat_rate}
                      onCheckedChange={(v) => handleChange(row.id, "is_flat_rate", v)}
                    />
                  </div>

                  {edited.is_flat_rate && (
                    <NumField label="Flat Rate ($)" value={edited.flat_rate ?? 0} onChange={(v) => handleChange(row.id, "flat_rate", v)} />
                  )}

                  <NumField label="Per Seat Rate ($)" value={edited.per_seat_rate ?? 0} onChange={(v) => handleChange(row.id, "per_seat_rate", v)} />

                  <div className="flex items-center justify-between">
                    <Label>Active</Label>
                    <Switch
                      checked={edited.is_active}
                      onCheckedChange={(v) => handleChange(row.id, "is_active", v)}
                    />
                  </div>

                  <Button
                    className="w-full"
                    size="sm"
                    disabled={!isDirty(row.id) || updateMutation.isPending}
                    onClick={() => handleSave(row)}
                  >
                    <Save className="h-4 w-4 mr-2" /> Save Changes
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const NumField = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input
      type="number"
      step="0.01"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  </div>
);

export default AdminPricing;
