import type { FareEstimateAuditRow } from "@/components/FareEstimateAuditTable";

const escapeCsv = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const HEADERS = [
  "id",
  "created_at",
  "event_type",
  "rider_name",
  "rider_profile_id",
  "service_type",
  "pickup_address",
  "pickup_lat",
  "pickup_lng",
  "dropoff_address",
  "dropoff_lat",
  "dropoff_lng",
  "stop_count",
  "distance_km",
  "estimated_fare_cents",
  "fare_inputs_key",
  "previous_fare_inputs_key",
  "stale_reason",
  "metadata_json",
];

export function fareEstimateRowsToCsv(rows: FareEstimateAuditRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const previousKey =
      typeof meta.previous_fare_inputs_key === "string"
        ? meta.previous_fare_inputs_key
        : meta.previous_fare_inputs_key === null
          ? ""
          : "";
    const reason = typeof meta.reason === "string" ? meta.reason : "";

    lines.push(
      [
        r.id,
        r.created_at,
        r.event_type,
        r.profiles?.full_name ?? "",
        r.rider_profile_id ?? "",
        r.service_type ?? "",
        r.pickup_address ?? "",
        r.pickup_lat ?? "",
        r.pickup_lng ?? "",
        r.dropoff_address ?? "",
        r.dropoff_lat ?? "",
        r.dropoff_lng ?? "",
        r.stop_count,
        r.distance_km ?? "",
        r.estimated_fare_cents ?? "",
        r.fare_inputs_key,
        previousKey,
        reason,
        JSON.stringify(meta),
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
