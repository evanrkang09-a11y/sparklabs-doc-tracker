/**
 * Compares OpenRouter models on the one job we actually need them for:
 * naming a Korean investment document from a messy filename.
 *
 * Every case below is one the keyword matcher in lib/documents.ts genuinely
 * misses, and that a person reading the filename would get right. The last
 * case has no right answer on purpose - a model that confidently labels
 * IMG_4821.jpg has told us something worse than "I don't know".
 *
 * Usage (from the project root):
 *   node --env-file=.env.local scripts/bench-models.mjs
 */

const MODELS = [
  "qwen/qwen3.7-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3.1-flash-lite",
  "openai/gpt-5-mini",
  "anthropic/claude-haiku-4.5",
];

// id: expected answer. null = should refuse to guess.
const CASES = [
  ["제스트_등기_최신본_v3.pdf", "corporate-registry"],
  ["주주_명단_최종.xlsx", "shareholder-registry"],
  ["Articles_of_Incorp_ZEST.pdf", "articles-of-incorporation"],
  ["대표이사_주민등록_2026.pdf", "ceo-id"],
  ["매출_5개년_추정치.xlsx", "revenue-forecast"],
  ["IMG_4821.jpg", null],
];

const CHECKLIST = `- ir-deck: 최신 사업소개서 (IR덱)
- business-registration: 사업자등록증
- corporate-registry: 등기부등본
- articles-of-incorporation: 정관
- corporate-seal: 법인 인감증명서
- shareholder-registry: 주주명부
- social-insurance: 4대보험 가입자명부
- stock-options: 스톡옵션 수여자 명단 및 상세
- bank-account: 법인 통장사본
- bank-balance: 통장잔액증명서
- financial-statements: 재무제표
- loans-and-advances: 가수금 / 차입금 상세
- key-personnel-cv: 대표자 및 주요 인력 이력서
- revenue-forecast: 매출 추정 (향후 5개년)
- ceo-id: 대표자 신분증 및 주민등록등본
- shareholders-agreement: 주주간 계약서
- other-entities: 대표자의 타 법인 / 개인사업자 보유여부
- tax-clearance: 법인 및 대표자 납세증명서
- venture-certificate: 벤처기업확인증
- patents: 특허 등록 또는 출원서
- trademarks: 상표 등록 또는 출원서`;

const SYSTEM = `You identify Korean and English startup investment documents from their filenames alone.

You are given a checklist of documents a company owes an investor, and uploaded filenames that a keyword matcher failed to classify. For each filename, decide which checklist document it most likely is.

Rules:
- Answer only with an id from the checklist, or null.
- null is the right answer when the filename is genuinely ambiguous. A wrong id is worse than null, because it marks a document as received when it is not.
- Filenames are often abbreviated, misspelled, in mixed Korean and English, or carry version suffixes like _final_v2 or (1). Read through that.
- Use the full confidence range honestly rather than hedging everything into the middle.
- Keep each reason to one short sentence, in Korean.`;

const SCHEMA = {
  type: "object",
  properties: {
    guesses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: { type: "string" },
          documentId: { type: ["string", "null"] },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: ["filename", "documentId", "confidence", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["guesses"],
  additionalProperties: false,
};

const key = process.env.OPENROUTER_API_KEY?.trim();
if (!key) {
  console.error("OPENROUTER_API_KEY is not set. Run with --env-file=.env.local");
  process.exit(1);
}

async function run(model) {
  const started = Date.now();

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `체크리스트:\n${CHECKLIST}\n\n분류할 파일명:\n${CASES.map(
            ([name]) => `- ${name}`,
          ).join("\n")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "guesses", strict: true, schema: SCHEMA },
      },
    }),
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`);

  const text = body.choices?.[0]?.message?.content ?? "";
  // Some models wrap JSON in ```json fences even when asked not to.
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    guesses: parsed.guesses ?? [],
    ms: Date.now() - started,
    usage: body.usage ?? {},
  };
}

console.log(`Testing ${MODELS.length} models on ${CASES.length} cases\n`);

for (const model of MODELS) {
  try {
    const { guesses, ms, usage } = await run(model);
    const byName = new Map(guesses.map((g) => [g.filename, g]));

    let correct = 0;
    const lines = [];

    for (const [filename, expected] of CASES) {
      const got = byName.get(filename);
      const answer = got?.documentId ?? null;
      const ok = answer === expected;
      if (ok) correct += 1;
      lines.push(
        `    ${ok ? "OK  " : "MISS"} ${filename}\n` +
          `         expected=${expected ?? "null"} got=${answer ?? "null"}` +
          ` conf=${got ? got.confidence : "-"}`,
      );
    }

    console.log(`${model}`);
    console.log(`  ${correct}/${CASES.length} correct | ${ms}ms | ` +
      `in=${usage.prompt_tokens ?? "?"} out=${usage.completion_tokens ?? "?"}`);
    console.log(lines.join("\n"));
    console.log("");
  } catch (problem) {
    console.log(`${model}\n  FAILED: ${problem.message}\n`);
  }
}
