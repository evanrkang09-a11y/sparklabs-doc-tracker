/**
 * The contract types the agreement page can produce, and everything each one
 * needs: its field groups, its template file, and helpers bound to its fields.
 *
 * CPS is the original convertible-preferred agreement. SAFE is the
 * 조건부지분인수계약. RCPS is reserved — no template yet, so it's shown but not
 * selectable until its draft is prepared.
 *
 * The per-field helpers mirror the ones in agreement-fields.ts but are built
 * from whichever groups a contract uses, so the editor, preview and download
 * all operate on the right field set.
 */

import {
  AGREEMENT_GROUPS,
  type AgreementField,
  type AgreementGroup,
  type AgreementValues,
} from "./agreement-fields";
import { SAFE_GROUPS } from "./safe-fields";
import { RCPS_GROUPS } from "./rcps-fields";

export type ContractType = "cps" | "rcps" | "safe";

export type ContractSpec = {
  groups: AgreementGroup[];
  allFields: AgreementField[];
  fieldByToken: Record<string, AgreementField>;
  defaultValues: () => AgreementValues;
  tokenValues: (values: AgreementValues) => Record<string, string>;
  missingFields: (values: AgreementValues) => AgreementField[];
  departsFromStandard: (values: AgreementValues) => AgreementField[];
};

function buildSpec(groups: AgreementGroup[]): ContractSpec {
  const allFields = groups.flatMap((group) => group.fields);
  const fieldByToken = Object.fromEntries(
    allFields.flatMap((field) => field.tokens.map((token) => [token, field])),
  );

  return {
    groups,
    allFields,
    fieldByToken,
    defaultValues() {
      const values: AgreementValues = {};
      for (const field of allFields) if (field.default) values[field.id] = field.default;
      return values;
    },
    tokenValues(values) {
      const out: Record<string, string> = {};
      for (const field of allFields) {
        const value = values[field.id]?.trim();
        if (!value) continue;
        for (const token of field.tokens) out[token] = value;
      }
      return out;
    },
    missingFields(values) {
      return allFields.filter((field) => !values[field.id]?.trim());
    },
    departsFromStandard(values) {
      return allFields.filter(
        (field) =>
          field.standard &&
          field.default &&
          (values[field.id]?.trim() ?? "") !== field.default,
      );
    },
  };
}

export type ContractMeta = {
  id: ContractType;
  labelKo: string;
  labelEn: string;
  /** false = shown in the picker but not yet usable (no template). */
  ready: boolean;
  /** Filename under templates/, or null when not prepared. */
  templateFile: string | null;
  spec: ContractSpec;
};

export const CONTRACTS: Record<ContractType, ContractMeta> = {
  cps: {
    id: "cps",
    labelKo: "전환우선주 (CPS)",
    labelEn: "CPS",
    ready: true,
    templateFile: "investment-agreement.docx",
    spec: buildSpec(AGREEMENT_GROUPS),
  },
  safe: {
    id: "safe",
    labelKo: "조건부지분인수 (SAFE)",
    labelEn: "SAFE",
    ready: true,
    templateFile: "safe-agreement.docx",
    spec: buildSpec(SAFE_GROUPS),
  },
  rcps: {
    id: "rcps",
    labelKo: "상환전환우선주 (RCPS)",
    labelEn: "RCPS",
    ready: true,
    templateFile: "rcps-agreement.docx",
    spec: buildSpec(RCPS_GROUPS),
  },
};

export const CONTRACT_ORDER: ContractType[] = ["cps", "rcps", "safe"];

export function isContractType(value: unknown): value is ContractType {
  return value === "cps" || value === "rcps" || value === "safe";
}

export function getContract(type: ContractType): ContractMeta {
  return CONTRACTS[type] ?? CONTRACTS.cps;
}
