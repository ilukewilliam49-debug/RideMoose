import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Save, Car, Briefcase, Bus, Gauge, Percent, Settings, PawPrint, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables } from "@/integrations/supabase/types";

type ServicePricing = Tables<"service_pricing">;

interface TaxiRate {
  id: string;
  base_fare_cents: number;
  per_km_cents: number;
  waiting_per_min_cents: number;
  free_waiting_min: number;
  active: boolean;
  created_at: string;
}

const serviceConfig = {
  taxi: { label: "Taxi", icon: Car, color: "text-yellow-500" },
  private_hire: { label: "PickYou", icon: Briefcase, color: "text-blue-500" },
  shuttle: { label: "Shuttle", icon: Bus, color: "text-green-500" },
} as const;

const AdminPricing = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [editState, setEditState] = useState<Record<string, Partial<ServicePricing>>>({});
  const [taxiEdit, setTaxiEdit] = useState<Partial<TaxiRate>>({});
  const [configEdits, setConfigEdits] = useState<Record<string, number>>({});
  const [configDirty, setConfigDirty] = useState<Record<string, boolean>>({});

  type PlatformConfigRow = { id: string; key: string; value: number; label: string; updated_at: string };

  const { data: allPlatformConfig } = useQuery({
    queryKey: ["platform-config-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("*")
        .order("key");
      if (error) throw error;
      const rows = data as PlatformConfigRow[];
      // Initialize edit state from DB on first load
      const initial: Record<string, number> = {};
      rows.forEach((r) => {
        if (configEdits[r.key] === undefined) initial[r.key] = Number(r.value);
      });
      if (Object.keys(initial).length) {
        setConfigEdits((prev) => ({ ...initial, ...prev }));
      }
      return rows;
    },
  });

  const configMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number }) => {
      const { error } = await supabase
        .from("platform_config")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["platform-config-all"] });
      setConfigDirty((p) => ({ ...p, [vars.key]: false }));
      toast.success(t("pricing.settingUpdated"));
    },
    onError: (err: any) => toast.error(err.message),
  });

  const configItems: { key: string; type: "slider" | "cents" | "percent"; min?: number; max?: number; step?: number; description: string }[] = [
    { key: "commission_rate", type: "slider", min: 0, max: 30, step: 0.5, description: "Commission deducted from driver gross fares." },
    { key: "service_fee_cents", type: "cents", description: "Flat fee added to every ride, charged to the rider." },
    { key: "stripe_rate_percent", type: "percent", description: "Stripe card processing rate used to estimate driver earnings." },
    { key: "stripe_fixed_cents", type: "cents", description: "Stripe fixed fee per transaction (in cents)." },
  ];

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

  const { data: taxiRate, isLoading: taxiLoading } = useQuery({
    queryKey: ["admin-taxi-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("taxi_rates")
        .select("*")
        .eq("active", true)
        .limit(1)
        .single();
      if (error) throw error;
      return data as unknown as TaxiRate;
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
      toast.success(t("pricing.pricingUpdated"));
    },
    onError: (err: any) => toast.error(err.message),
  });

  const taxiMutation = useMutation({
    mutationFn: async (updates: Partial<TaxiRate>) => {
      if (!taxiRate) throw new Error("No taxi rate found");
      const { error } = await supabase
        .from("taxi_rates")
        .update(updates)
        .eq("id", taxiRate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-taxi-rates"] });
      setTaxiEdit({});
      toast.success(t("pricing.meterRatesUpdated"));
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
  const taxiDirty = Object.keys(taxiEdit).length > 0;

  const editedTaxi = taxiRate ? { ...taxiRate, ...taxiEdit } : null;

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">{t("pricing.loading")}</div>;
  }

  return (
    <div className="space-y-8 pt-4">
      <button onClick={() => navigate("/admin")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </button>
      <h1 className="text-2xl font-bold">{t("pricing.title")}</h1>

      {/* Platform Financial Settings */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" /> {t("pricing.platformSettings")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {configItems.map((item) => {
            const row = allPlatformConfig?.find((r) => r.key === item.key);
            const val = configEdits[item.key] ?? (row ? Number(row.value) : 0);
            const dirty = configDirty[item.key] || false;

            return (
              <motion.div key={item.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{row?.label || item.key}</Label>
                      {item.type === "slider" && (
                        <span className="text-2xl font-bold font-mono">{val}%</span>
                      )}
                      {item.type === "cents" && (
                        <span className="text-2xl font-bold font-mono">${(val / 100).toFixed(2)}</span>
                      )}
                      {item.type === "percent" && (
                        <span className="text-2xl font-bold font-mono">{val}%</span>
                      )}
                    </div>

                    {item.type === "slider" ? (
                      <>
                        <Slider
                          min={item.min ?? 0}
                          max={item.max ?? 30}
                          step={item.step ?? 0.5}
                          value={[val]}
                          onValueChange={([v]) => {
                            setConfigEdits((p) => ({ ...p, [item.key]: v }));
                            setConfigDirty((p) => ({ ...p, [item.key]: true }));
                          }}
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{item.min ?? 0}%</span>
                          <span>{item.max ?? 30}%</span>
                        </div>
                      </>
                    ) : item.type === "cents" ? (
                      <CentsField
                        label=""
                        cents={val}
                        onChange={(v) => {
                          setConfigEdits((p) => ({ ...p, [item.key]: v }));
                          setConfigDirty((p) => ({ ...p, [item.key]: true }));
                        }}
                      />
                    ) : (
                      <NumField
                        label=""
                        value={val}
                        onChange={(v) => {
                          setConfigEdits((p) => ({ ...p, [item.key]: v }));
                          setConfigDirty((p) => ({ ...p, [item.key]: true }));
                        }}
                      />
                    )}

                    <p className="text-xs text-muted-foreground">{item.description}</p>
                    <Button
                      size="sm"
                      disabled={!dirty || configMutation.isPending}
                      onClick={() => configMutation.mutate({ key: item.key, value: val })}
                    >
                      <Save className="h-4 w-4 mr-2" /> {t("pricing.save")}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Taxi Meter Rates */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" /> {t("pricing.taxiMeterRates")}
        </h2>
        {taxiLoading ? (
          <p className="text-sm text-muted-foreground">{t("pricing.loading")}</p>
        ) : editedTaxi ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <CentsField label={t("pricing.baseFare")} cents={editedTaxi.base_fare_cents} onChange={(v) => setTaxiEdit((p) => ({ ...p, base_fare_cents: v }))} />
                  <CentsField label={t("pricing.perKm")} cents={editedTaxi.per_km_cents} onChange={(v) => setTaxiEdit((p) => ({ ...p, per_km_cents: v }))} />
                  <CentsField label={t("pricing.perMinWaiting")} cents={editedTaxi.waiting_per_min_cents} onChange={(v) => setTaxiEdit((p) => ({ ...p, waiting_per_min_cents: v }))} />
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("pricing.freeWaiting")}</Label>
                    <Input type="number" min={0} value={editedTaxi.free_waiting_min} onChange={(e) => setTaxiEdit((p) => ({ ...p, free_waiting_min: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
                <Button
                  className="mt-4"
                  size="sm"
                  disabled={!taxiDirty || taxiMutation.isPending}
                  onClick={() => taxiMutation.mutate(taxiEdit)}
                >
                  <Save className="h-4 w-4 mr-2" /> {t("pricing.saveMeterRates")}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("pricing.noTaxiRate")}</p>
        )}
      </div>

      {/* Pet Transport Rates */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <PawPrint className="h-5 w-5 text-primary" /> {t("pricing.petTransportRates")}
        </h2>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(["pet_surcharge_cents", "pet_only_base_cents", "pet_only_per_km_cents", "pet_only_minimum_cents"] as const).map((key) => {
                  const labelMap: Record<string, string> = {
                    pet_surcharge_cents: t("pricing.petSurcharge"),
                    pet_only_base_cents: t("pricing.petOnlyBase"),
                    pet_only_per_km_cents: t("pricing.petOnlyPerKm"),
                    pet_only_minimum_cents: t("pricing.petOnlyMinimum"),
                  };
                  const row = allPlatformConfig?.find((r) => r.key === key);
                  const val = configEdits[key] ?? (row ? Number(row.value) : 0);
                  return (
                    <CentsField
                      key={key}
                      label={labelMap[key]}
                      cents={val}
                      onChange={(v) => {
                        setConfigEdits((p) => ({ ...p, [key]: v }));
                        setConfigDirty((p) => ({ ...p, [key]: true }));
                      }}
                    />
                  );
                })}
                {/* Pet commission rate (percent) */}
                {(() => {
                  const key = "pet_transport_commission_percent";
                  const row = allPlatformConfig?.find((r) => r.key === key);
                  const val = configEdits[key] ?? (row ? Number(row.value) : 7);
                  return (
                    <div className="space-y-1" key={key}>
                      <Label className="text-xs text-muted-foreground">{t("pricing.petCommission")}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={val}
                          onChange={(e) => {
                            setConfigEdits((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }));
                            setConfigDirty((p) => ({ ...p, [key]: true }));
                          }}
                        />
                        <Percent className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  );
                })()}
              </div>
              <Button
                className="mt-4"
                size="sm"
                disabled={
                  !(configDirty["pet_surcharge_cents"] || configDirty["pet_only_base_cents"] || configDirty["pet_only_per_km_cents"] || configDirty["pet_only_minimum_cents"] || configDirty["pet_transport_commission_percent"]) ||
                  configMutation.isPending
                }
                onClick={() => {
                  const petKeys = ["pet_surcharge_cents", "pet_only_base_cents", "pet_only_per_km_cents", "pet_only_minimum_cents", "pet_transport_commission_percent"];
                  petKeys.forEach((key) => {
                    if (configDirty[key]) {
                      configMutation.mutate({ key, value: configEdits[key] ?? 0 });
                    }
                  });
                }}
              >
                <Save className="h-4 w-4 mr-2" /> {t("pricing.savePetRates")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Service Pricing Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t("pricing.generalPricing")}</h2>
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
                    <NumField label={t("pricing.baseFare") + " ($)"} value={edited.base_fare} onChange={(v) => handleChange(row.id, "base_fare", v)} />
                    <NumField label={t("pricing.perKmRate")} value={edited.per_km_rate} onChange={(v) => handleChange(row.id, "per_km_rate", v)} />
                    <NumField label={t("pricing.perMinRate")} value={edited.per_min_rate} onChange={(v) => handleChange(row.id, "per_min_rate", v)} />
                    <NumField label={t("pricing.minimumFare")} value={edited.minimum_fare} onChange={(v) => handleChange(row.id, "minimum_fare", v)} />
                    <NumField label={t("pricing.surgeMultiplier")} value={edited.surge_multiplier} onChange={(v) => handleChange(row.id, "surge_multiplier", v)} />

                    <div className="flex items-center justify-between">
                      <Label>{t("pricing.flatRate")}</Label>
                      <Switch
                        checked={edited.is_flat_rate}
                        onCheckedChange={(v) => handleChange(row.id, "is_flat_rate", v)}
                      />
                    </div>

                    {edited.is_flat_rate && (
                      <NumField label={t("pricing.flatRateAmount")} value={edited.flat_rate ?? 0} onChange={(v) => handleChange(row.id, "flat_rate", v)} />
                    )}

                    <NumField label={t("pricing.perSeatRate")} value={edited.per_seat_rate ?? 0} onChange={(v) => handleChange(row.id, "per_seat_rate", v)} />

                    <div className="flex items-center justify-between">
                      <Label>{t("pricing.active")}</Label>
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
                      <Save className="h-4 w-4 mr-2" /> {t("pricing.saveChanges")}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
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

const CentsField = ({ label, cents, onChange }: { label: string; cents: number; onChange: (v: number) => void }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="flex items-center gap-2">
      <Input
        type="number"
        step="0.01"
        value={(cents / 100).toFixed(2)}
        onChange={(e) => onChange(Math.round((parseFloat(e.target.value) || 0) * 100))}
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap">({cents}¢)</span>
    </div>
  </div>
);

export default AdminPricing;
