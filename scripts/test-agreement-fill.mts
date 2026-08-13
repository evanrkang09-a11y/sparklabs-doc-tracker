/**
 * Fills the template with sample values and checks the result is a real docx.
 *
 * A generated contract that Word refuses to open is the worst failure this
 * feature has, and it's invisible until someone double-clicks the file. So:
 * fill it, write it out, re-open the archive, and confirm the values landed.
 *
 *   node scripts/test-agreement-fill.ts
 */

import { writeFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { fillAgreement } from "../lib/agreement-docx";
import { defaultValues } from "../lib/agreement-fields";

const values = {
  ...defaultValues(),
  signMonth: "8",
  signDay: "14",
  companyName: "주식회사 제스트",
  companyAddress: "서울특별시 강남구 테헤란로 1",
  companyRep: "홍길동",
  interestedName: "홍길동",
  interestedAddress: "서울특별시 서초구 서초대로 2",
  interestedBirth: "900101-1234567",
  newShares: "280",
  existingShares: "3,440",
  parValue: "5,000",
  parValueWords: "오천",
  issuePrice: "800,167",
  issuePriceWords: "팔십만일백육십칠",
  totalAmount: "224,046,760",
  totalAmountWords: "이억이천사백사만육천칠백육십",
  // Deliberately includes an ampersand - unescaped it produces a file Word
  // refuses to open.
  investorRep: "Smith & Partners",
};

const { bytes, unfilled } = await fillAgreement(values);
const out = "test-filled-agreement.docx";
await writeFile(out, bytes);

console.log(`written: ${out}  (${(bytes.length / 1024).toFixed(0)} KB)`);
console.log(`tokens left unfilled: ${unfilled.length}`);
if (unfilled.length) console.log(`  ${unfilled.join(", ")}`);

// Re-open it the way Word would.
const parts = unzipSync(bytes);
const names = Object.keys(parts);
const xml = new TextDecoder().decode(parts["word/document.xml"]);

console.log(`\nparts in output: ${names.length}`);
console.log(`[Content_Types].xml present: ${names.includes("[Content_Types].xml")}`);
console.log(`document.xml well-formed-ish: ${xml.startsWith("<?xml") && xml.trimEnd().endsWith(">")}`);

const checks: [string, boolean][] = [
  ["company name landed", xml.includes("주식회사 제스트")],
  ["share count landed", xml.includes("280")],
  ["amount in words landed", xml.includes("이억이천사백사만육천칠백육십")],
  ["ampersand escaped", xml.includes("Smith &amp; Partners")],
  ["raw ampersand absent", !xml.includes("Smith & Partners")],
  ["12% 위약벌 present", xml.includes("12")],
  ["no leftover highlight", !xml.includes("<w:highlight")],
];

console.log("");
for (const [label, ok] of checks) {
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}`);
}
