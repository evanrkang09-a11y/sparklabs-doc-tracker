export const PERMISSIONS = ["documents", "agreements", "execution", "conversion"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, { ko: string; en: string }> = {
  documents: { ko: "서류 수집", en: "Document Tracking" },
  agreements: { ko: "계약서 작성", en: "Agreements" },
  execution: { ko: "투자 집행", en: "Execution" },
  conversion: { ko: "SAFE 전환", en: "Conversion" },
};

/** Route prefix → permission required. Checked by middleware. */
export const ROUTE_PERMISSIONS: { prefix: string; permission: Permission }[] = [
  { prefix: "/deal/", permission: "documents" },
  { prefix: "/diligence/", permission: "documents" },
  { prefix: "/agreement/", permission: "agreements" },
  { prefix: "/execution/", permission: "execution" },
  { prefix: "/conversion/", permission: "conversion" },
];

/** New employees get all standard permissions by default. */
export const DEFAULT_EMPLOYEE_PERMISSIONS: Permission[] = [
  "documents",
  "agreements",
  "execution",
  "conversion",
];
