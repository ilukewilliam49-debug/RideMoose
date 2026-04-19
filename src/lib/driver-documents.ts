import type { DocumentSpec } from "@/components/driver/DocumentUploadCard";

export const DRIVER_DOCUMENTS: DocumentSpec[] = [
  {
    type: "drivers_license",
    label: "Driver's License",
    optional: false,
    helper: "Valid government-issued driver's license (front side).",
    tips: [
      "Clear photo of the front — all 4 corners visible",
      "No glare or reflections",
      "Name and license number must be readable",
    ],
  },
  {
    type: "vehicle_insurance",
    label: "Vehicle Insurance",
    optional: false,
    helper: "Current insurance certificate or pink slip.",
    tips: [
      "Must be valid (not expired)",
      "Show your name and the vehicle's plate or VIN",
      "Photo of the page or a PDF works",
    ],
  },
  {
    type: "vehicle_registration",
    label: "Vehicle Registration",
    optional: false,
    helper: "Valid vehicle registration document.",
    tips: [
      "Show plate number, VIN, and your name",
      "Make sure the registration is current",
    ],
  },
  {
    type: "chauffeurs_permit",
    label: "Chauffeur's Permit",
    optional: true,
    helper: "Required only if you'll be driving Taxi service in Yellowknife. Skip for Courier or PickYou.",
    tips: [
      "Issued by the City of Yellowknife",
      "Skip this if you're only doing courier or private hire",
    ],
  },
];

export const REQUIRED_DOC_TYPES = DRIVER_DOCUMENTS.filter((d) => !d.optional).map(
  (d) => d.type,
);
