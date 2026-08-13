/**
 * Suggests values for agreement fields by reading a company's uploaded documents.
 *
 * Modelled after lib/analysis.ts. The model reads the PDFs and extracts what it
 * can find - company name, address, representative, share counts, etc. Whatever
 * it cannot find comes back as an empty string and is filtered out.
 *
 * The result is a best-effort hint, not an authoritative fill. A person still
 * checks every value before saving.
 */

import type { Deal } from "./deals";
import { callOpenRouter } from "./openrouter";
import { readFileAsDataUrl } from "./storage";
import type { TrackedDocument } from "./deal-status";

export type FieldSuggestions = Record<string, string>;

const READABLE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
]);

const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

type LoadedFile = { name: string; dataUrl: string };

async function loadFiles(dealId: string, filenames: string[]): Promise<LoadedFile[]> {
  const loaded = await Promise.all(
    filenames.slice(0, 8).map(async (name) => ({
      name,
      file: await readFileAsDataUrl(dealId, name),
    })),
  );

  const usable: LoadedFile[] = [];
  let budget = MAX_REQUEST_BYTES;

  for (const { name, file } of loaded) {
    if (!file || !READABLE_TYPES.has(file.contentType)) continue;
    if (file.dataUrl.length > budget) break;

    budget -= file.dataUrl.length;
    usable.push({ name, dataUrl: file.dataUrl });
  }

  return usable;
}

const SUGGEST_SCHEMA = {
  type: "object",
  properties: {
    companyName: { type: "string" },
    companyAddress: { type: "string" },
    companyRep: { type: "string" },
    interestedName: { type: "string" },
    interestedAddress: { type: "string" },
    noticeCompanyTo: { type: "string" },
    noticeCompanyAddress: { type: "string" },
    noticeCompanyPhone: { type: "string" },
    noticeCompanyEmail: { type: "string" },
    newShares: { type: "string" },
    existingShares: { type: "string" },
    parValue: { type: "string" },
    issuePrice: { type: "string" },
    totalAmount: { type: "string" },
  },
  required: [
    "companyName",
    "companyAddress",
    "companyRep",
    "interestedName",
    "interestedAddress",
    "noticeCompanyTo",
    "noticeCompanyAddress",
    "noticeCompanyPhone",
    "noticeCompanyEmail",
    "newShares",
    "existingShares",
    "parValue",
    "issuePrice",
    "totalAmount",
  ],
  additionalProperties: false,
} as const;

const SUGGEST_SYSTEM = `You assist a Korean venture capital firm filling in an investment agreement.

You are given a company's uploaded documents. Extract the values you can find from them to pre-fill the agreement fields listed below.

Rules:
- Only return values you actually see in the documents. Never invent or guess.
- Return an empty string "" for any field you cannot find. That is the correct answer when evidence is absent.
- 사업자등록증 (business registration certificate): use for company name (상호/법인명), address (소재지), representative (대표자), and phone.
- 법인등기부등본 (corporate registry extract): use for company name, address, representative, and share count.
- Term sheets, board resolutions (이사회의사록), or share subscription agreements: use for newShares, issuePrice, totalAmount.
- Numbers: digits only, no commas or currency symbols. "5000000" not "5,000,000" not "₩5,000,000".
- interestedName: usually the same person as companyRep (the CEO). Use the same value.
- Korean is the working language; use Korean for names and addresses as they appear in the documents.`;

export async function suggestAgreementFields(
  deal: Deal,
  documents: TrackedDocument[],
): Promise<FieldSuggestions> {
  const filenames = documents
    .filter((doc) => doc.submitted)
    .flatMap((doc) => doc.files.filter((f) => f.source === "upload").map((f) => f.name));

  if (filenames.length === 0) return {};

  const usable = await loadFiles(deal.id, filenames);
  if (usable.length === 0) return {};

  const brief = [
    `기업: ${deal.companyKo} (${deal.companyEn})`,
    "",
    "투자계약서에 필요한 아래 항목들을 첨부 서류에서 찾아 주세요:",
    "- companyName: 회사명",
    "- companyAddress: 회사 주소",
    "- companyRep: 대표자",
    "- interestedName: 이해관계인 이름 (보통 대표자와 동일)",
    "- interestedAddress: 이해관계인 주소",
    "- noticeCompanyTo: 통지 수신인 (회사)",
    "- noticeCompanyAddress: 통지 주소 (회사)",
    "- noticeCompanyPhone: 회사 전화번호",
    "- noticeCompanyEmail: 회사 이메일",
    "- newShares: 본건 발행 종류주식 수",
    "- existingShares: 기 발행 보통주 수",
    "- parValue: 1주당 액면가액",
    "- issuePrice: 1주당 발행가액",
    "- totalAmount: 총 인수대금",
  ].join("\n");

  const content = [
    { type: "text", text: brief },
    ...usable.map((file) => ({
      type: "file",
      file: { filename: file.name, file_data: file.dataUrl },
    })),
  ];

  const parsed = await callOpenRouter({
    system: SUGGEST_SYSTEM,
    content,
    schema: SUGGEST_SCHEMA,
    schemaName: "agreement-suggestions",
    maxTokens: 800,
    readsFiles: true,
  });

  const out: FieldSuggestions = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
    }
  }

  return out;
}
