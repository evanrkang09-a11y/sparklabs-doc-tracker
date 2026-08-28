"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Deal } from "@/lib/deals";
import { FIELD_BY_TOKEN, type AgreementField, type AgreementValues } from "@/lib/agreement-fields";
import {
  CONTRACT_ORDER,
  CONTRACTS,
  getContract,
  type ContractType,
} from "@/lib/contracts";
import type { FieldSuggestions } from "@/lib/agreement-suggest";
import type { AgreementRecord } from "@/lib/agreement-store";
import type { Annotation } from "@/lib/agreement-annotations-store";
import type { AgreementSuggestion } from "@/lib/agreement-suggestions-store";
import type { Block, DocxLayout } from "@/lib/docx-layout";
import { T } from "@/lib/i18n";
import { describe } from "@/lib/errors";
import { useLang } from "@/app/lang-provider";
import PhaseDateEditor from "@/app/phase-date-editor";
import ContractView, { type ActiveSlot } from "./contract-view";
import SafePanel from "./safe-panel";

/** Year/month/day sub-fields that are collapsed into their group's date input. */
const DATE_HEADS = new Set(["signYear", "paymentYear", "closingYear", "financialsYear"]);
const DATE_SUBS = new Set([
  "signMonth", "signDay",
  "paymentMonth", "paymentDay",
  "closingMonth", "closingDay",
  "financialsMonth", "financialsDay",
]);

/** Four date triplets collapsed into single YYYY-MM-DD inputs. */
const DATE_GROUPS = [
  {
    id: "signYear",
    labelKo: "체결일",
    labelEn: "Signing date",
    hintKo: "표지·전문·서명란·별지2에 반영",
    hintEn: "Cover, preamble, signature block and appendix 2",
    yearId: "signYear",
    monthId: "signMonth",
    dayId: "signDay",
  },
  {
    id: "paymentYear",
    labelKo: "납입기일",
    labelEn: "Payment date",
    hintKo: "본건 종류주식의 납입기일",
    hintEn: "Payment date for the preferred shares",
    yearId: "paymentYear",
    monthId: "paymentMonth",
    dayId: "paymentDay",
  },
  {
    id: "closingYear",
    labelKo: "거래완결 기한",
    labelEn: "Closing deadline",
    hintKo: "이 날까지 완결되지 않으면 해제 사유",
    hintEn: "Missing this date is grounds for termination",
    yearId: "closingYear",
    monthId: "closingMonth",
    dayId: "closingDay",
  },
  {
    id: "financialsYear",
    labelKo: "재무제표 기준일",
    labelEn: "Financial statements as of",
    hintKo: "진술 및 보장의 기준이 되는 재무제표 일자",
    hintEn: "The financials the warranties are given against",
    yearId: "financialsYear",
    monthId: "financialsMonth",
    dayId: "financialsDay",
  },
] as const;

/**
 * Contract on the left, the values that fill it on the right.
 *
 * The preview substitutes tokens in the browser as you type, so the effect of a
 * change is immediate and costs nothing. The .docx download goes to the server,
 * which fills the real template - the preview is for reading, the docx is the
 * document.
 *
 * A token with no value stays visible in both, on purpose: an empty term in a
 * contract reads as deliberate, where a visible gap reads as unfinished. On
 * screen the gap shows the field's name (hover for the raw token); the .docx
 * keeps the literal {{f27}}.
 *
 * Clicking into a field jumps the contract to where that value lands, like
 * Ctrl+F. Several fields fill more than one place - the signing year fills five
 * - so it goes to the first one and marks the rest faintly.
 */

/**
 * Scrolls the contract pane so a slot sits in the middle of it.
 *
 * Deliberately not `scrollIntoView`: the contract is a scrolling box inside the
 * page, and scrollIntoView also scrolls the page itself, which yanks the input
 * being typed in out of view.
 */
function centreWithin(container: HTMLElement, node: HTMLElement) {
  const outer = container.getBoundingClientRect();
  const inner = node.getBoundingClientRect();

  container.scrollTop +=
    inner.top - outer.top - container.clientHeight / 2 + inner.height / 2;
}
/** Fields the startup can fill in directly without going through suggestions. */
const STARTUP_WRITABLE_FIELDS = new Set([
  "companyName", "companyAddress", "companyRep",
  "interestedName", "interestedAddress", "interestedBirth",
  "noticeCompanyTo", "noticeCompanyAddress", "noticeCompanyPhone", "noticeCompanyEmail",
  "noticeInterestedTo", "noticeInterestedAddress", "noticeInterestedPhone", "noticeInterestedEmail",
]);

export default function AgreementEditor({
  deal,
  layouts,
  initial,
  userRole = "employee",
  userEmail = "",
  userName = "",
}: {
  deal: Deal;
  /** The drawable layout per ready contract type, slots still empty. */
  layouts: Partial<Record<ContractType, DocxLayout>>;
  initial: AgreementRecord;
  userRole?: string;
  userEmail?: string;
  userName?: string;
}) {
  const isStartup = userRole === "startup";
  const { lang, t, pick } = useLang();

  const [contractType, setContractType] = useState<ContractType>(initial.contractType);
  const [values, setValues] = useState<AgreementValues>(initial.values);
  const [overrides, setOverrides] = useState<Record<string, string>>(initial.overrides ?? {});
  const [saved, setSaved] = useState<AgreementRecord>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Everything below reads the active contract's fields, tokens and layout.
  const contract = getContract(contractType);
  const spec = contract.spec;
  const layout = layouts[contractType];

  /**
   * Raw text the user is actively typing into a date group input.
   * Keyed by date group id (= yearId). Cleared on blur so the display
   * falls back to the value derived from the stored year/month/day fields.
   */
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});

  const [suggestions, setSuggestions] = useState<FieldSuggestions>({});
  const [suggesting, setSuggesting] = useState(false);
  const [suggestMessage, setSuggestMessage] = useState<string | null>(null);

  /** The field being edited, and the one slot the contract is scrolled to. */
  const [active, setActive] = useState<ActiveSlot>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef(new Map<string, HTMLElement>());

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [annotationComment, setAnnotationComment] = useState("");
  const [annotationBusy, setAnnotationBusy] = useState(false);
  const [annotationError, setAnnotationError] = useState<string | null>(null);

  // Company suggestions: loaded for both roles.
  const [companySuggestions, setCompanySuggestions] = useState<AgreementSuggestion[]>([]);
  // Startup-only: which field they're currently filling in a suggestion form.
  const [suggestFieldId, setSuggestFieldId] = useState<string | null>(null);
  const [suggestValue, setSuggestValue] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Startup-only: paragraph text suggestion state.
  const [showParaSuggestPopover, setShowParaSuggestPopover] = useState(false);
  const [paraSuggestBlockKey, setParaSuggestBlockKey] = useState<string | null>(null);
  const [paraSuggestSelectedText, setParaSuggestSelectedText] = useState("");
  const [paraSuggestProposedText, setParaSuggestProposedText] = useState("");
  const [paraSuggestNote, setParaSuggestNote] = useState("");
  const [paraSuggestBusy, setParaSuggestBusy] = useState(false);
  const [paraSuggestError, setParaSuggestError] = useState<string | null>(null);

  // Floating selection UI state.
  const [selectionRect, setSelectionRect] = useState<{
    top: number; right: number; bottom: number; left: number;
  } | null>(null);
  const [selectionToken, setSelectionToken] = useState<string | null>(null);
  const [selectionBlockKey, setSelectionBlockKey] = useState<string | null>(null);
  const [showSuggestPopover, setShowSuggestPopover] = useState(false);

  // Inline annotation viewer: shown when user clicks a 💬 marker in the contract.
  const [focusedAnnotationIds, setFocusedAnnotationIds] = useState<string[]>([]);
  const [focusedAnnotationRect, setFocusedAnnotationRect] = useState<{
    top: number; left: number;
  } | null>(null);

  const dirty = useMemo(
    () =>
      JSON.stringify(values) !== JSON.stringify(saved.values) ||
      JSON.stringify(overrides) !== JSON.stringify(saved.overrides ?? {}) ||
      contractType !== saved.contractType,
    [values, overrides, saved.values, saved.overrides, contractType, saved.contractType],
  );

  // Warn before losing edits - a half-filled contract is real work.
  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    fetch(`/api/deals/${deal.id}/agreement/annotations`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (Array.isArray(data)) setAnnotations(data); })
      .catch(() => {});
  }, [deal.id]);

  useEffect(() => {
    fetch(`/api/deals/${deal.id}/agreement/suggestions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (Array.isArray(data)) setCompanySuggestions(data as AgreementSuggestion[]); })
      .catch(() => {});
  }, [deal.id]);

  // For the employee contract view: pending FIELD suggestions mapped fieldId → proposedValue.
  // Slots for these fields are highlighted orange and show the proposed value in context.
  const pendingSuggestionsMap = useMemo<Record<string, string>>(() => {
    if (isStartup) return {};
    return Object.fromEntries(
      companySuggestions
        .filter((s) => s.status === "pending" && s.fieldId)
        .map((s) => [s.fieldId!, s.proposedValue ?? ""]),
    );
  }, [companySuggestions, isStartup]);

  // Pending PARAGRAPH suggestions grouped by blockKey — shown as orange highlights in the contract.
  const paragraphSuggestionsByBlock = useMemo(() => {
    const map: Record<string, { id: string; selectedText: string; proposedText: string; authorName: string }> = {};
    for (const s of companySuggestions) {
      if (s.status !== "pending" || !s.blockKey || !s.proposedText) continue;
      map[s.blockKey] = {
        id: s.id,
        selectedText: s.selectedText ?? "",
        proposedText: s.proposedText,
        authorName: s.authorName,
      };
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [companySuggestions]);

  // Annotations grouped by their paragraph blockKey — passed into ContractView
  // so each paragraph can highlight itself and show a 💬 marker.
  const annotationsByBlock = useMemo(() => {
    const map: Record<string, { id: string; comment: string; authorName: string }[]> = {};
    for (const ann of annotations) {
      if (!ann.blockKey) continue;
      if (!map[ann.blockKey]) map[ann.blockKey] = [];
      map[ann.blockKey].push({ id: ann.id, comment: ann.comment, authorName: ann.authorName });
    }
    return map;
  }, [annotations]);

  // Handles clicks on 💬 markers rendered inside the contract by ContractView.
  const handleContractClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as Element).closest("[data-ann-btn]");
    if (!btn) return;
    const ids = btn.getAttribute("data-annotation-ids")?.split(",").filter(Boolean) ?? [];
    const rect = btn.getBoundingClientRect();
    setFocusedAnnotationIds(ids);
    setFocusedAnnotationRect({ top: rect.bottom + 6, left: rect.left });
  }, []);

  const handleContractMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!text || !sel?.rangeCount) {
      if (!text) {
        setSelectedText("");
        setSelectionRect(null);
        setSelectionToken(null);
        setShowAnnotationForm(false);
        setShowSuggestPopover(false);
      }
      return;
    }
    if (!previewRef.current?.contains(sel.anchorNode)) return;

    const range = sel.getRangeAt(0);
    const r = range.getBoundingClientRect();

    // Walk up from the anchor node to find a data-token span and a data-blockkey paragraph.
    let node: Element | null =
      sel.anchorNode instanceof Element
        ? sel.anchorNode
        : sel.anchorNode?.parentElement ?? null;
    let foundToken: string | null = null;
    let foundBlockKey: string | null = null;
    while (node && node !== previewRef.current) {
      if (!foundToken) {
        const tok = node.getAttribute?.("data-token");
        if (tok) foundToken = tok;
      }
      if (!foundBlockKey) {
        const bk = node.getAttribute?.("data-blockkey");
        if (bk) foundBlockKey = bk;
      }
      if (foundToken && foundBlockKey) break;
      node = node.parentElement;
    }

    setSelectedText(text);
    setSelectionRect({ top: r.top, right: r.right, bottom: r.bottom, left: r.left });
    setSelectionToken(foundToken);
    setSelectionBlockKey(foundBlockKey);
    setShowAnnotationForm(false);
    setShowSuggestPopover(false);
    setAnnotationComment("");
    setAnnotationError(null);
  }, []);

  // Close floating panels when the user clicks outside any of them.
  useEffect(() => {
    const hasOpen = selectedText || focusedAnnotationIds.length > 0;
    if (!hasOpen) return;
    function onDocClick(e: MouseEvent) {
      if ((e.target as Element).closest("[data-floating-panel]")) return;
      // Clicking a 💬 button is handled by handleContractClick — don't also close here.
      if ((e.target as Element).closest("[data-ann-btn]")) return;
      if (previewRef.current?.contains(e.target as Node) && !selectedText) return;
      setSelectedText("");
      setSelectionRect(null);
      setSelectionToken(null);
      setSelectionBlockKey(null);
      setShowAnnotationForm(false);
      setShowSuggestPopover(false);
      setShowParaSuggestPopover(false);
      setFocusedAnnotationIds([]);
      setFocusedAnnotationRect(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [selectedText, focusedAnnotationIds.length]);

  async function saveAnnotation() {
    if (!annotationComment.trim() || !selectedText) return;
    setAnnotationBusy(true);
    setAnnotationError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/agreement/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedText, blockKey: selectionBlockKey, comment: annotationComment }),
      });
      const parsed = await res.json().catch(() => null);
      if (!res.ok) throw new Error(parsed?.error ?? `${res.status}`);
      setAnnotations((prev) => [parsed as Annotation, ...prev]);
      setSelectedText("");
      setSelectionRect(null);
      setSelectionToken(null);
      setSelectionBlockKey(null);
      setShowAnnotationForm(false);
      setAnnotationComment("");
      window.getSelection()?.removeAllRanges();
    } catch (problem) {
      setAnnotationError(describe(problem));
    } finally {
      setAnnotationBusy(false);
    }
  }

  async function deleteAnnotationById(id: string) {
    const res = await fetch(`/api/deals/${deal.id}/agreement/annotations?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }

  // Temp-save: a contract is rarely filled in one sitting, so persist quietly a
  // short while after edits stop. The manual Save button still works; this just
  // means closing the tab mid-draft doesn't lose anything.
  useEffect(() => {
    if (!dirty || saving) return;
    const timer = setTimeout(() => {
      void save();
    }, 1500);
    return () => clearTimeout(timer);
    // save reads the latest values from its closure; re-running on values change
    // is what makes the autosave pick them up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, contractType, dirty]);

  const missing = useMemo(() => spec.missingFields(values), [spec, values]);
  const changedStandards = useMemo(
    () => spec.departsFromStandard(values),
    [spec, values],
  );

  /**
   * Each field's slots in the order they appear in the contract.
   *
   * Read off the document rather than taken from `field.tokens`, because token
   * numbers are not document order - the year tokens were appended as f78-f85
   * so that the earlier numbering stayed stable. The two happen to agree in
   * today's template; `scripts/check-slot-order.mts` reports it if they stop.
   */
  const slotsByField = useMemo(() => {
    const map = new Map<string, string[]>();

    const walk = (blocks: Block[]) => {
      for (const block of blocks) {
        if (block.kind === "table") {
          for (const row of block.rows) for (const cell of row) walk(cell.blocks);
          continue;
        }

        for (const run of block.runs) {
          if (!run.token) continue;
          const field = spec.fieldByToken[run.token];
          // Orphan tokens (in the template but not registered as a named field)
          // use their own token string as the map key so they still get an input.
          const key = field ? field.id : run.token;
          map.set(key, [...(map.get(key) ?? []), run.token]);
        }
      }
    };

    if (layout) walk(layout.blocks);
    return map;
  }, [layout, spec]);

  /**
   * Fields ordered by first appearance in the contract (document order), so
   * the sidebar reads top-to-bottom just like the contract does.
   *
   * Date sub-fields (month/day) are excluded here — they're rendered as part
   * of their group's aggregated date input.
   */
  const sortedFields = useMemo<AgreementField[]>(() => {
    const seen = new Set<string>();
    const result: AgreementField[] = [];

    for (const fieldId of slotsByField.keys()) {
      if (!seen.has(fieldId) && !DATE_SUBS.has(fieldId)) {
        seen.add(fieldId);
        const field = spec.allFields.find((f) => f.id === fieldId);
        if (field) {
          result.push(field);
        } else {
          // Orphan token: in the template but has no registered field definition.
          // Expose it as a plain text input so every highlighted token is editable.
          result.push({ id: fieldId, labelKo: fieldId, labelEn: fieldId, kind: "text", tokens: [fieldId] });
        }
      }
    }

    // Append anything not in the template (e.g. words/copy fields with no slot).
    for (const field of spec.allFields) {
      if (!seen.has(field.id) && !DATE_SUBS.has(field.id)) {
        result.push(field);
        seen.add(field.id);
      }
    }

    return result;
  }, [slotsByField, spec]);

  const replacements = useMemo(() => {
    const base = spec.tokenValues(values);
    // Orphan tokens store their value directly under the token id in `values`.
    // Merge them into replacements so the live preview fills them too.
    for (const fieldId of slotsByField.keys()) {
      if (!spec.allFields.find((f) => f.id === fieldId)) {
        const val = values[fieldId]?.trim();
        if (val) base[fieldId] = val;
      }
    }
    return base;
  }, [spec, values, slotsByField]);

  /** What to show in a slot nobody has filled yet. */
  const slotLabel = useMemo(
    () => (token: string) => {
      const field = spec.fieldByToken[token];
      return field ? pick(field.labelKo, field.labelEn) : `{{${token}}}`;
    },
    [pick, spec],
  );

  /** Scrolls the contract to where this field lands, and marks the spot. */
  function locate(fieldId: string) {
    const first = slotsByField.get(fieldId)?.[0];
    if (!first) return;

    setActive({ fieldId, token: first });

    const container = previewRef.current;
    const slot = container?.querySelector<HTMLElement>(`[data-token="${first}"]`);
    if (container && slot) centreWithin(container, slot);
  }

  /** Reconstructs the YYYY-MM-DD string from stored year/month/day values. */
  function derivedDate(group: (typeof DATE_GROUPS)[number]) {
    const y = values[group.yearId]?.trim();
    const m = values[group.monthId]?.trim();
    const d = values[group.dayId]?.trim();
    if (!y || !m || !d) return "";
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}/agreement`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, contractType, overrides }),
      });

      const parsed = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);

      setSaved(parsed as AgreementRecord);
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setSaving(false);
    }
  }

  async function downloadDocx() {
    // The server fills from the SAVED draft, so save first or the file won't
    // match what's on screen.
    if (dirty) await save();

    setDownloading(true);
    setError(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}/agreement/download`);
      if (!response.ok) {
        const parsed = await response.json().catch(() => null);
        throw new Error(parsed?.error ?? `${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `투자계약서_${deal.companyKo || deal.id}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (problem) {
      setError(describe(problem));
    } finally {
      setDownloading(false);
    }
  }

  async function fetchSuggestions() {
    setSuggesting(true);
    setSuggestMessage(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}/agreement/suggest`, {
        method: "POST",
      });

      const parsed = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parsed?.error ?? `${response.status}`);

      const found = parsed as FieldSuggestions;
      setSuggestions(found);

      const count = Object.keys(found).length;
      setSuggestMessage(count === 0 ? t(T.aiSuggestNone) : null);
    } catch (problem) {
      setSuggestMessage(`${t(T.aiSuggestFailed)}: ${describe(problem)}`);
    } finally {
      setSuggesting(false);
    }
  }

  /** Applies all suggestions to fields that are still empty. */
  function applyAllSuggestions() {
    setValues((current) => {
      const next = { ...current };
      for (const [fieldId, suggestion] of Object.entries(suggestions)) {
        if (!next[fieldId]?.trim()) next[fieldId] = suggestion;
      }
      return next;
    });
  }

  function focusField(id: string) {
    const node = fieldRefs.current.get(id);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    node?.focus();
  }

  function handleParagraphEdit(key: string, text: string) {
    setOverrides((prev) => {
      if (text === "") {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: text };
    });
  }

  async function submitSuggestion(): Promise<boolean> {
    if (!suggestFieldId || !suggestValue.trim()) return false;
    setSuggestBusy(true);
    setSuggestError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/agreement/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldId: suggestFieldId, proposedValue: suggestValue, note: suggestNote }),
      });
      const parsed = await res.json().catch(() => null);
      if (!res.ok) throw new Error(parsed?.error ?? `${res.status}`);
      setCompanySuggestions((prev) => {
        const filtered = prev.filter(
          (s) => !(s.fieldId === suggestFieldId && s.status === "pending"),
        );
        return [...filtered, parsed as AgreementSuggestion];
      });
      setSuggestFieldId(null);
      setSuggestValue("");
      setSuggestNote("");
      return true;
    } catch (problem) {
      setSuggestError(describe(problem));
      return false;
    } finally {
      setSuggestBusy(false);
    }
  }

  async function submitParaSuggestion(): Promise<boolean> {
    if (!paraSuggestBlockKey || !paraSuggestProposedText.trim()) return false;
    setParaSuggestBusy(true);
    setParaSuggestError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/agreement/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockKey: paraSuggestBlockKey,
          selectedText: paraSuggestSelectedText,
          proposedText: paraSuggestProposedText.trim(),
          note: paraSuggestNote.trim() || undefined,
        }),
      });
      const parsed = await res.json().catch(() => null);
      if (!res.ok) throw new Error(parsed?.error ?? `${res.status}`);
      setCompanySuggestions((prev) => {
        const filtered = prev.filter((s) => !(s.blockKey === paraSuggestBlockKey && s.status === "pending"));
        return [...filtered, parsed as AgreementSuggestion];
      });
      setParaSuggestBlockKey(null);
      setParaSuggestSelectedText("");
      setParaSuggestProposedText("");
      setParaSuggestNote("");
      return true;
    } catch (problem) {
      setParaSuggestError(describe(problem));
      return false;
    } finally {
      setParaSuggestBusy(false);
    }
  }

  // Employee: accept or reject a paragraph suggestion from the contract view inline buttons.
  const handleParagraphSuggestionAction = useCallback(
    async (id: string, action: "approve" | "reject") => {
      const s = companySuggestions.find((cs) => cs.id === id);
      if (!s?.blockKey) return;

      let overrideText: string | undefined;
      if (action === "approve" && s.selectedText !== undefined && s.proposedText) {
        // Get the paragraph's current rendered text from the DOM.
        const paraEl = previewRef.current?.querySelector<HTMLElement>(`[data-blockkey="${s.blockKey}"]`);
        const currentText = paraEl?.textContent ?? s.selectedText;
        overrideText = currentText.includes(s.selectedText)
          ? currentText.replace(s.selectedText, s.proposedText)
          : s.proposedText;
      }

      const res = await fetch(`/api/deals/${deal.id}/agreement/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(overrideText !== undefined ? { overrideText } : {}) }),
      });
      const parsed = await res.json().catch(() => null);
      if (!res.ok) return;

      setCompanySuggestions((prev) => prev.map((cs) => (cs.id === id ? (parsed as AgreementSuggestion) : cs)));

      if (action === "approve" && s.blockKey && overrideText) {
        setOverrides((prev) => ({ ...prev, [s.blockKey!]: overrideText! }));
      }
    },
    [companySuggestions, deal.id],
  );

  async function retractSuggestion(id: string) {
    const res = await fetch(`/api/deals/${deal.id}/agreement/suggestions/${id}`, { method: "DELETE" });
    if (res.ok) setCompanySuggestions((prev) => prev.filter((s) => s.id !== id));
  }

  async function reviewSuggestion(id: string, action: "approve" | "reject") {
    const res = await fetch(`/api/deals/${deal.id}/agreement/suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const parsed = await res.json().catch(() => null);
    if (!res.ok) return;
    setCompanySuggestions((prev) => prev.map((s) => (s.id === id ? (parsed as AgreementSuggestion) : s)));
    // If approved, reload the agreement so the new value reflects immediately.
    if (action === "approve") {
      fetch(`/api/deals/${deal.id}/agreement`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && typeof data === "object" && "values" in data) {
            const record = data as typeof initial;
            setValues(record.values);
            setSaved(record);
          }
        })
        .catch(() => {});
    }
  }

  /** Switches contract type, seeding that contract's defaults for empty fields. */
  function switchContract(type: ContractType) {
    if (type === contractType || !CONTRACTS[type].ready) return;
    setContractType(type);
    setValues((current) => ({ ...getContract(type).spec.defaultValues(), ...current }));
    setActive(null);
  }

  const input =
    "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950";

  return (
    <div className="w-full px-4 py-6">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {pick(deal.companyKo, deal.companyEn)} · {t(T.agreementTitle)}
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">{t(T.agreementIntro)}</p>

          {/* Contract type selector — CPS / RCPS tabs + separate SAFE button (employees only) */}
          <div className={`mt-2 flex flex-wrap items-center gap-2${isStartup ? " hidden" : ""}`}>
            <div className="inline-flex rounded-lg border border-neutral-300 p-0.5 dark:border-neutral-700">
              {CONTRACT_ORDER.filter((t) => t !== "safe").map((type) => {
                const meta = CONTRACTS[type];
                const activeType = type === contractType;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => switchContract(type)}
                    disabled={!meta.ready}
                    title={meta.ready ? undefined : lang === "ko" ? "템플릿 준비 중" : "Template not ready yet"}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      activeType
                        ? "bg-indigo-600 text-white"
                        : meta.ready
                          ? "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          : "cursor-not-allowed text-neutral-300 dark:text-neutral-600"
                    }`}
                  >
                    {pick(meta.labelKo, meta.labelEn)}
                  </button>
                );
              })}
            </div>

            {/* SAFE — separate button, not part of the main tab strip */}
            <button
              type="button"
              onClick={() => switchContract("safe")}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                contractType === "safe"
                  ? "border-violet-400 bg-violet-600 text-white"
                  : "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-950/60"
              }`}
              title={lang === "ko" ? "SAFE 조건부지분인수계약서" : "SAFE — Conditional Equity Agreement"}
            >
              <span>⚡</span>
              <span>SAFE</span>
              {contractType !== "safe" && (
                <span className="text-violet-400 dark:text-violet-600">+</span>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isStartup ? (
            <>
              {(() => {
                const pending = companySuggestions.filter((s) => s.status === "pending").length;
                return pending > 0 ? (
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                    {pending} {lang === "ko" ? "건 검토 대기 중" : pending === 1 ? "suggestion pending" : "suggestions pending"}
                  </span>
                ) : null;
              })()}
              <span className="text-xs text-neutral-400">
                {dirty
                  ? t(T.unsavedChanges)
                  : saved.updatedAt
                    ? `${t(T.savedBy)} ${new Date(saved.updatedAt).toLocaleString()}${saved.updatedBy ? ` · ${saved.updatedBy}` : ""}`
                    : t(T.neverSaved)}
              </span>
              <button
                type="button"
                onClick={save}
                disabled={saving || !dirty}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? t(T.preparing) : t(T.saveAgreement)}
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-neutral-400">
                {dirty
                  ? t(T.unsavedChanges)
                  : saved.updatedAt
                    ? `${t(T.savedBy)} ${new Date(saved.updatedAt).toLocaleString()}${
                        saved.updatedBy ? ` · ${saved.updatedBy}` : ""
                      }`
                    : t(T.neverSaved)}
              </span>

              {/* Pending company suggestions banner */}
              {companySuggestions.filter((s) => s.status === "pending").length > 0 && (
                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                  {companySuggestions.filter((s) => s.status === "pending").length}{" "}
                  {lang === "ko" ? "건 회사 제안" : "company suggestion(s) pending"}
                </span>
              )}

              {/* Save: emerald so it stands apart from the PDF button beside it. */}
              <button
                type="button"
                onClick={save}
                disabled={saving || !dirty}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? t(T.preparing) : t(T.saveAgreement)}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                {t(T.downloadPdf)}
              </button>

              <button
                type="button"
                onClick={downloadDocx}
                disabled={downloading}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                {downloading ? t(T.preparing) : t(T.downloadDocx)}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 print:hidden dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="lg:grid lg:grid-cols-[1fr_26rem] lg:gap-6">
        {/* The contract */}
        <div
          ref={previewRef}
          onMouseUp={handleContractMouseUp}
          onClick={handleContractClick}
          className="max-h-[calc(100vh-11rem)] overflow-auto rounded-xl border border-neutral-200 bg-neutral-100 p-4 print:max-h-none print:overflow-visible print:border-0 print:bg-white print:p-0 dark:border-neutral-800 dark:bg-neutral-900"
        >
          {layout ? (
            <ContractView
              layout={layout}
              replacements={replacements}
              active={active}
              label={slotLabel}
              overrides={overrides}
              onParagraphEdit={isStartup ? undefined : handleParagraphEdit}
              pendingSuggestions={Object.keys(pendingSuggestionsMap).length > 0 ? pendingSuggestionsMap : undefined}
              annotationsByBlock={Object.keys(annotationsByBlock).length > 0 ? annotationsByBlock : undefined}
              paragraphSuggestionsByBlock={paragraphSuggestionsByBlock}
              onParagraphSuggestionAction={isStartup ? undefined : handleParagraphSuggestionAction}
            />
          ) : (
            <p className="py-8 text-center text-sm text-neutral-400">
              {lang === "ko" ? "계약서 템플릿을 불러올 수 없습니다." : "Could not load this contract template."}
            </p>
          )}
        </div>

        {/* ── Startup sidebar ─────────────────────────────────────────── */}
        {isStartup ? (
          <aside className="mt-6 max-h-[calc(100vh-11rem)] overflow-y-auto lg:mt-0 print:hidden">
            {/* Company info — startup-writable fields, saved directly */}
            <div className="mb-4 rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {lang === "ko" ? "회사 정보" : "Company info"}
              </p>
              <div className="space-y-2.5">
                {sortedFields.filter((f) => STARTUP_WRITABLE_FIELDS.has(f.id)).map((field) => {
                  const value = values[field.id] ?? "";
                  return (
                    <div key={field.id}>
                      <label className="block text-[11px] font-medium text-neutral-500" htmlFor={field.id}>
                        {pick(field.labelKo, field.labelEn)}
                      </label>
                      <input
                        id={field.id}
                        ref={(node) => { if (node) fieldRefs.current.set(field.id, node); }}
                        value={value}
                        onFocus={() => locate(field.id)}
                        onBlur={() => setActive(null)}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        className={input}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !dirty}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {saving ? (lang === "ko" ? "저장 중…" : "Saving…") : (lang === "ko" ? "저장" : "Save")}
                </button>
                {error && <p className="text-[10px] text-red-500">{error}</p>}
              </div>
            </div>

            {/* Suggest a change to any other term */}
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 dark:border-orange-900 dark:bg-orange-950/20">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                {lang === "ko" ? "조항 변경 제안" : "Suggest a change"}
              </p>
              {suggestFieldId ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-orange-700 dark:text-orange-300">
                    {lang === "ko" ? "필드:" : "Field:"}{" "}
                    <span className="font-medium">
                      {(() => {
                        const f = sortedFields.find((x) => x.id === suggestFieldId);
                        return f ? pick(f.labelKo, f.labelEn) : suggestFieldId;
                      })()}
                    </span>
                    {values[suggestFieldId] && (
                      <span className="ml-1 text-neutral-400">
                        ({lang === "ko" ? "현재:" : "Current:"} {values[suggestFieldId]})
                      </span>
                    )}
                  </p>
                  <input
                    autoFocus
                    value={suggestValue}
                    onChange={(e) => setSuggestValue(e.target.value)}
                    placeholder={lang === "ko" ? "제안 값 입력…" : "Enter proposed value…"}
                    className="w-full rounded-md border border-orange-300 bg-white px-2.5 py-1.5 text-xs focus:border-orange-500 focus:outline-none dark:border-orange-800 dark:bg-neutral-950"
                  />
                  <textarea
                    value={suggestNote}
                    onChange={(e) => setSuggestNote(e.target.value)}
                    placeholder={lang === "ko" ? "설명 (선택)…" : "Note (optional)…"}
                    rows={2}
                    className="w-full rounded-md border border-orange-300 bg-white px-2.5 py-1.5 text-xs focus:border-orange-500 focus:outline-none dark:border-orange-800 dark:bg-neutral-950"
                  />
                  {suggestError && <p className="text-[10px] text-red-500">{suggestError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={submitSuggestion}
                      disabled={suggestBusy || !suggestValue.trim()}
                      className="rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {suggestBusy ? "…" : (lang === "ko" ? "제출" : "Submit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSuggestFieldId(null); setSuggestValue(""); setSuggestNote(""); setSuggestError(null); }}
                      className="rounded-md border border-orange-300 px-3 py-1 text-xs"
                    >
                      {lang === "ko" ? "취소" : "Cancel"}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-[10px] text-orange-600 dark:text-orange-400">
                    {lang === "ko"
                      ? "변경하고 싶은 조항을 선택하고 제안을 제출하세요. SparkLabs 담당자가 검토합니다."
                      : "Select a term you'd like changed and submit a suggestion. SparkLabs will review it."}
                  </p>
                  <select
                    onChange={(e) => {
                      if (!e.target.value) return;
                      setSuggestFieldId(e.target.value);
                      setSuggestValue(values[e.target.value] ?? "");
                      setSuggestNote("");
                      setSuggestError(null);
                    }}
                    defaultValue=""
                    className="w-full rounded-md border border-orange-300 bg-white px-2.5 py-1.5 text-xs focus:border-orange-500 focus:outline-none dark:border-orange-800 dark:bg-neutral-950"
                  >
                    <option value="">{lang === "ko" ? "필드 선택…" : "Select a field…"}</option>
                    {sortedFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {pick(f.labelKo, f.labelEn)}
                        {values[f.id] ? ` — ${values[f.id]}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Pending suggestions from this startup */}
            {companySuggestions.filter((s) => s.status === "pending").length > 0 && (
              <div className="mb-4 rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  {lang === "ko" ? "검토 대기 중인 제안" : "Pending suggestions"}
                </p>
                <ul className="space-y-2">
                  {companySuggestions.filter((s) => s.status === "pending").map((s) => {
                    if (s.blockKey) {
                      // Paragraph suggestion
                      return (
                        <li key={s.id} className="rounded-lg border border-orange-200 bg-orange-50 p-2.5 text-xs dark:border-orange-900 dark:bg-orange-950/20">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                            {lang === "ko" ? "문단 변경 제안" : "Paragraph edit"}
                          </p>
                          <p className="mt-0.5 text-neutral-500 line-through line-clamp-2">&ldquo;{s.selectedText}&rdquo;</p>
                          <p className="mt-0.5 font-medium text-orange-800 dark:text-orange-200 line-clamp-2">&ldquo;{s.proposedText}&rdquo;</p>
                          {s.note && <p className="mt-0.5 text-[10px] text-neutral-400 italic">{s.note}</p>}
                          <button
                            type="button"
                            onClick={() => retractSuggestion(s.id)}
                            className="mt-1.5 text-[10px] text-red-400 hover:text-red-600"
                          >
                            {lang === "ko" ? "철회" : "Retract"}
                          </button>
                        </li>
                      );
                    }
                    // Field suggestion
                    const f = sortedFields.find((x) => x.id === s.fieldId);
                    return (
                      <li key={s.id} className="rounded-lg border border-orange-200 bg-orange-50 p-2.5 text-xs dark:border-orange-900 dark:bg-orange-950/20">
                        <p className="font-medium text-orange-800 dark:text-orange-200">
                          {f ? pick(f.labelKo, f.labelEn) : s.fieldId}
                        </p>
                        <p className="mt-0.5 text-neutral-600 dark:text-neutral-300">&ldquo;{s.proposedValue}&rdquo;</p>
                        {s.note && <p className="mt-0.5 text-[10px] text-neutral-400 italic">{s.note}</p>}
                        <button
                          type="button"
                          onClick={() => retractSuggestion(s.id)}
                          className="mt-1.5 text-[10px] text-red-400 hover:text-red-600"
                        >
                          {lang === "ko" ? "철회" : "Retract"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Comments list */}
            <div className="mt-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {lang === "ko" ? `댓글 (${annotations.length})` : `Comments (${annotations.length})`}
              </p>
              {annotations.length === 0 && (
                <p className="text-xs text-neutral-400">
                  {lang === "ko"
                    ? "계약서에서 텍스트를 드래그하여 댓글을 추가하세요."
                    : "Highlight text in the contract to add a comment."}
                </p>
              )}
              {annotations.length > 0 && (
                <ul className="space-y-3">
                  {annotations.map((ann) => (
                    <li
                      key={ann.id}
                      className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <p className="line-clamp-2 text-[10px] italic text-neutral-400">
                        &ldquo;{ann.selectedText}&rdquo;
                      </p>
                      <p className="mt-1.5 text-xs text-neutral-800 dark:text-neutral-200">
                        {ann.comment}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p className="text-[10px] text-neutral-400">
                          {ann.authorName} &middot;{" "}
                          {new Date(ann.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <button
                          type="button"
                          onClick={() => deleteAnnotationById(ann.id)}
                          className="text-[10px] text-neutral-300 transition-colors hover:text-red-500 dark:text-neutral-600 dark:hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        ) : (
        /* ── Employee / Admin sidebar ───────────────────────────────── */
        <aside className="mt-6 max-h-[calc(100vh-11rem)] overflow-y-auto lg:mt-0 print:hidden">
          {contractType === "safe" ? (
            <SafePanel
              values={values}
              onChange={(id, val) => setValues((prev) => ({ ...prev, [id]: val }))}
              saved={saved}
              suggestions={suggestions}
              lang={lang}
              locate={locate}
              fieldRefs={fieldRefs}
            />
          ) : (
            <>
              <div className="mb-4 rounded-lg border border-neutral-200 px-3 py-2.5 text-xs dark:border-neutral-800">
                {missing.length === 0 ? (
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">
                    {t(T.allFieldsFilled)}
                  </p>
                ) : (
                  <>
                    <p className="font-medium">
                      {t(T.fieldsRemaining)}: {missing.length}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {missing.slice(0, 8).map((field) => (
                        <button
                          key={field.id}
                          type="button"
                          onClick={() => focusField(field.id)}
                          className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                        >
                          {pick(field.labelKo, field.labelEn)}
                        </button>
                      ))}
                      {missing.length > 8 && (
                        <span className="px-1 py-0.5 text-[11px] text-neutral-400">
                          +{missing.length - 8}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {changedStandards.length > 0 && (
                  <p className="mt-2 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                    {t(T.standardChanged)} —{" "}
                    {changedStandards
                      .map((field) => pick(field.labelKo, field.labelEn))
                      .join(", ")}
                    <span className="mt-0.5 block opacity-80">{t(T.standardNote)}</span>
                  </p>
                )}
              </div>

              {/* Paragraph suggestions from the startup */}
              {companySuggestions.filter((s) => s.status === "pending" && s.blockKey).length > 0 && (
                <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 dark:border-orange-900 dark:bg-orange-950/20">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                    {lang === "ko" ? "문단 변경 제안" : "Paragraph changes suggested"}
                  </p>
                  <ul className="space-y-2">
                    {companySuggestions.filter((s) => s.status === "pending" && s.blockKey).map((s) => (
                      <li key={s.id} className="rounded-lg border border-orange-200 bg-white p-2.5 text-xs dark:border-orange-900 dark:bg-neutral-900">
                        <p className="text-[10px] text-neutral-500 line-through line-clamp-2">&ldquo;{s.selectedText}&rdquo;</p>
                        <p className="mt-0.5 font-medium text-orange-800 dark:text-orange-200 line-clamp-2">&ldquo;{s.proposedText}&rdquo;</p>
                        {s.note && <p className="mt-0.5 text-[10px] italic text-neutral-400">{s.note}</p>}
                        <p className="mt-0.5 text-[10px] text-neutral-400">
                          {s.authorName} &middot;{" "}
                          {new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </p>
                        <div className="mt-1.5 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleParagraphSuggestionAction(s.id, "approve")}
                            className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-700"
                          >
                            {lang === "ko" ? "승인" : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewSuggestion(s.id, "reject")}
                            className="rounded border border-neutral-300 px-2 py-0.5 text-[10px] hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                          >
                            {lang === "ko" ? "거절" : "Reject"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI suggestion panel */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={fetchSuggestions}
                  disabled={suggesting}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {suggesting ? t(T.aiSuggesting) : t(T.aiSuggestFields)}
                </button>

                {Object.keys(suggestions).length > 0 && (
                  <>
                    <span className="text-xs text-neutral-500">
                      {Object.keys(suggestions).length}{t(T.aiSuggestCount)}
                    </span>
                    <button
                      type="button"
                      onClick={applyAllSuggestions}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-700"
                    >
                      {t(T.aiSuggestApplyAll)}
                    </button>
                  </>
                )}
              </div>

              {suggestMessage && (
                <p className="mb-4 rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800">
                  {suggestMessage}
                </p>
              )}

              <div className="space-y-2.5">
                {sortedFields.map((field) => {
                  // Date group head — render a single YYYY-MM-DD input.
                  if (DATE_HEADS.has(field.id)) {
                    const dg = DATE_GROUPS.find((g) => g.yearId === field.id)!;
                    const derived = derivedDate(dg);
                    const displayValue = dateDrafts[dg.id] ?? derived;
                    return (
                      <div key={field.id}>
                        <label
                          className="block text-[11px] font-medium text-neutral-500"
                          htmlFor={dg.id}
                        >
                          {pick(dg.labelKo, dg.labelEn)}
                        </label>
                        <input
                          id={dg.id}
                          ref={(node) => {
                            if (node) {
                              fieldRefs.current.set(dg.yearId, node);
                              fieldRefs.current.set(dg.monthId, node);
                              fieldRefs.current.set(dg.dayId, node);
                            }
                          }}
                          value={displayValue}
                          placeholder="YYYY-MM-DD"
                          onFocus={() => {
                            setDateDrafts((prev) => ({ ...prev, [dg.id]: derived }));
                            locate(dg.yearId);
                          }}
                          onBlur={() => {
                            setDateDrafts((prev) => {
                              const next = { ...prev };
                              delete next[dg.id];
                              return next;
                            });
                            setActive(null);
                          }}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setDateDrafts((prev) => ({ ...prev, [dg.id]: raw }));
                            const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                            if (match) {
                              const [, year, month, day] = match;
                              setValues((prev) => ({
                                ...prev,
                                [dg.yearId]: year,
                                [dg.monthId]: String(parseInt(month, 10)),
                                [dg.dayId]: String(parseInt(day, 10)),
                              }));
                            }
                          }}
                          className={`${input} placeholder:text-neutral-400 dark:placeholder:text-neutral-600`}
                        />
                        <p className="mt-0.5 text-[10px] text-neutral-400">
                          {lang === "ko" ? dg.hintKo : dg.hintEn}
                        </p>
                      </div>
                    );
                  }

                  // Normal field.
                  const value = values[field.id] ?? "";
                  const off =
                    field.standard && field.default && value.trim() !== field.default;
                  const slots = slotsByField.get(field.id)?.length ?? 0;
                  const suggestion = suggestions[field.id];
                  const hasSuggestion = suggestion && !value.trim();
                  const startupEdit = saved.startupEdits?.[field.id];
                  const companySuggestion = companySuggestions.find(
                    (s) => s.fieldId === field.id && s.status === "pending",
                  );

                  return (
                    <div key={field.id}>
                      <label
                        className="block text-[11px] font-medium text-neutral-500"
                        htmlFor={field.id}
                      >
                        {pick(field.labelKo, field.labelEn)}
                        {field.standard && (
                          <span className="ml-1 text-neutral-400">({field.default})</span>
                        )}
                        {slots > 1 && (
                          <span className="ml-1 text-neutral-400">×{slots}</span>
                        )}
                        {hasSuggestion && (
                          <button
                            type="button"
                            onClick={() =>
                              setValues((current) => ({ ...current, [field.id]: suggestion }))
                            }
                            className="ml-1.5 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-normal text-sky-700 transition-colors hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-300"
                          >
                            {t(T.aiSuggestApply)}
                          </button>
                        )}
                        {startupEdit && (
                          <span
                            title={`${lang === "ko" ? "회사 입력" : "Filled by company"} · ${startupEdit.editedBy} · ${new Date(startupEdit.editedAt).toLocaleDateString()}`}
                            className="ml-1.5 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-normal text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                          >
                            {lang === "ko" ? "회사" : "Co."}
                          </span>
                        )}
                        {companySuggestion && (
                          <span className="ml-1.5 rounded bg-orange-100 px-1 py-0.5 text-[10px] font-normal text-orange-700 dark:bg-orange-950/50 dark:text-orange-400">
                            {lang === "ko" ? "제안" : "Suggested"}
                          </span>
                        )}
                      </label>

                      <input
                        id={field.id}
                        ref={(node) => {
                          if (node) fieldRefs.current.set(field.id, node);
                        }}
                        value={value}
                        placeholder={suggestion ?? undefined}
                        onFocus={() => locate(field.id)}
                        onBlur={() => setActive(null)}
                        inputMode={
                          field.kind === "text" || field.kind === "words" ? "text" : "numeric"
                        }
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.id]: event.target.value,
                          }))
                        }
                        className={`${input} placeholder:text-neutral-400 dark:placeholder:text-neutral-600 ${
                          off ? "border-amber-400 dark:border-amber-700" : ""
                        } ${companySuggestion ? "border-orange-400 dark:border-orange-700" : ""}`}
                      />

                      {/* Inline suggestion review for employees */}
                      {companySuggestion && (
                        <div className="mt-1.5 rounded-lg border border-orange-200 bg-orange-50 p-2 text-[11px] dark:border-orange-900 dark:bg-orange-950/20">
                          <p className="text-orange-700 dark:text-orange-300">
                            <span className="font-medium">{lang === "ko" ? "제안:" : "Suggests:"}</span>{" "}
                            &ldquo;{companySuggestion.proposedValue}&rdquo;
                          </p>
                          {companySuggestion.note && (
                            <p className="mt-0.5 italic text-neutral-500">{companySuggestion.note}</p>
                          )}
                          <p className="mt-0.5 text-neutral-400">
                            {companySuggestion.authorName} &middot;{" "}
                            {new Date(companySuggestion.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </p>
                          <div className="mt-1.5 flex gap-2">
                            <button
                              type="button"
                              onClick={() => reviewSuggestion(companySuggestion.id, "approve")}
                              className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-700"
                            >
                              {lang === "ko" ? "승인" : "Approve"}
                            </button>
                            <button
                              type="button"
                              onClick={() => reviewSuggestion(companySuggestion.id, "reject")}
                              className="rounded border border-neutral-300 px-2 py-0.5 text-[10px] hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                            >
                              {lang === "ko" ? "거절" : "Reject"}
                            </button>
                          </div>
                        </div>
                      )}

                      {(field.hintKo || field.hintEn) && (
                        <p className="mt-0.5 text-[10px] text-neutral-400">
                          {lang === "ko" ? field.hintKo : field.hintEn}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Comments list */}
          <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              {lang === "ko" ? `댓글 (${annotations.length})` : `Comments (${annotations.length})`}
            </p>
            {annotations.length === 0 && (
              <p className="text-xs text-neutral-400">
                {lang === "ko"
                  ? "계약서에서 텍스트를 드래그하여 댓글을 추가하세요."
                  : "Highlight text in the contract to add a comment."}
              </p>
            )}
            {annotations.length > 0 && (
              <ul className="space-y-3">
                {annotations.map((ann) => (
                  <li
                    key={ann.id}
                    className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <p className="line-clamp-2 text-[10px] italic text-neutral-400">
                      &ldquo;{ann.selectedText}&rdquo;
                    </p>
                    <p className="mt-1.5 text-xs text-neutral-800 dark:text-neutral-200">
                      {ann.comment}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-neutral-400">
                        {ann.authorName} &middot;{" "}
                        {new Date(ann.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <button
                        type="button"
                        onClick={() => deleteAnnotationById(ann.id)}
                        className="text-[10px] text-neutral-300 transition-colors hover:text-red-500 dark:text-neutral-600 dark:hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
        )}
      </div>

      {!isStartup && (
        <div className="mt-8 print:hidden">
          <PhaseDateEditor dealId={deal.id} phase="agreement" large />
        </div>
      )}

      {/* ── Focused annotation card (clicking a 💬 marker) ─────────── */}
      {focusedAnnotationIds.length > 0 && focusedAnnotationRect && (
        <div
          data-floating-panel
          style={{
            position: "fixed",
            top: focusedAnnotationRect.top,
            left: focusedAnnotationRect.left,
            width: 300,
            zIndex: 9999,
          }}
          className="rounded-xl border border-yellow-200 bg-white p-3 shadow-xl print:hidden dark:border-yellow-900 dark:bg-neutral-900"
        >
          {focusedAnnotationIds.map((id) => {
            const ann = annotations.find((a) => a.id === id);
            if (!ann) return null;
            return (
              <div key={id} className="mb-3 last:mb-0">
                <p className="line-clamp-2 text-[10px] italic text-neutral-400">&ldquo;{ann.selectedText}&rdquo;</p>
                <p className="mt-1.5 text-sm text-neutral-800 dark:text-neutral-100">{ann.comment}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[10px] text-neutral-400">
                    {ann.authorName} &middot; {new Date(ann.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      deleteAnnotationById(ann.id);
                      setFocusedAnnotationIds((prev) => prev.filter((x) => x !== id));
                    }}
                    className="text-[10px] text-neutral-300 hover:text-red-500 dark:text-neutral-600 dark:hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => { setFocusedAnnotationIds([]); setFocusedAnnotationRect(null); }}
            className="mt-1 text-[10px] text-neutral-400 hover:text-neutral-600"
          >
            ✕ Close
          </button>
        </div>
      )}

      {/* ── Floating selection UI (Google Docs style) ────────────────── */}
      {selectedText && selectionRect && (
        <>
          {/* Bubble: appears above the selection, shows Comment (+ Suggest for startups) */}
          {!showAnnotationForm && !showSuggestPopover && !showParaSuggestPopover && (
            <div
              data-floating-panel
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: "fixed",
                top: Math.max(60, selectionRect.top - 46),
                left: selectionRect.left,
                zIndex: 9999,
              }}
              className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg print:hidden dark:border-neutral-700 dark:bg-neutral-900"
            >
              <button
                type="button"
                onClick={() => setShowAnnotationForm(true)}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                💬 {lang === "ko" ? "댓글" : "Comment"}
              </button>
              {isStartup && (() => {
                const field = selectionToken ? FIELD_BY_TOKEN[selectionToken] : null;
                if (field) {
                  // Token field → suggest a new value for that named field
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setSuggestFieldId(field.id);
                        setSuggestValue(values[field.id] ?? "");
                        setSuggestNote("");
                        setSuggestError(null);
                        setShowSuggestPopover(true);
                      }}
                      className="flex items-center gap-1.5 rounded-md border border-orange-300 bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/20 dark:text-orange-300"
                    >
                      ✏️ {lang === "ko" ? "수정 제안" : "Suggest edit"}
                    </button>
                  );
                } else if (selectionBlockKey) {
                  // Plain paragraph text → suggest a text replacement
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setParaSuggestBlockKey(selectionBlockKey);
                        setParaSuggestSelectedText(selectedText);
                        setParaSuggestProposedText(selectedText);
                        setParaSuggestNote("");
                        setParaSuggestError(null);
                        setShowParaSuggestPopover(true);
                      }}
                      className="flex items-center gap-1.5 rounded-md border border-orange-300 bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/20 dark:text-orange-300"
                    >
                      ✏️ {lang === "ko" ? "수정 제안" : "Suggest edit"}
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {/* Comment popover: appears below the selection */}
          {showAnnotationForm && (
            <div
              data-floating-panel
              style={{
                position: "fixed",
                top: selectionRect.bottom + 8,
                left: selectionRect.left,
                width: 280,
                zIndex: 9999,
              }}
              className="rounded-xl border border-neutral-200 bg-white p-3 shadow-xl print:hidden dark:border-neutral-700 dark:bg-neutral-900"
            >
              <p className="mb-1.5 line-clamp-2 text-[10px] italic text-neutral-400">
                &ldquo;{selectedText}&rdquo;
              </p>
              <textarea
                autoFocus
                value={annotationComment}
                onChange={(e) => setAnnotationComment(e.target.value)}
                placeholder={lang === "ko" ? "댓글을 입력하세요…" : "Add a comment…"}
                rows={3}
                maxLength={2000}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
                onKeyDown={(e) => { if (e.key === "Escape") setShowAnnotationForm(false); }}
              />
              {annotationError && (
                <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">{annotationError}</p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={saveAnnotation}
                  disabled={annotationBusy || !annotationComment.trim()}
                  className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {annotationBusy ? "…" : (lang === "ko" ? "저장" : "Save")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAnnotationForm(false);
                    setAnnotationComment("");
                    setSelectedText("");
                    setSelectionRect(null);
                  }}
                  className="rounded-md border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {lang === "ko" ? "취소" : "Cancel"}
                </button>
              </div>
            </div>
          )}

          {/* Para-suggest popover: startup only, for plain paragraph text selections */}
          {isStartup && showParaSuggestPopover && (
            <div
              data-floating-panel
              style={{
                position: "fixed",
                top: selectionRect.bottom + 8,
                left: selectionRect.left,
                width: 300,
                zIndex: 9999,
              }}
              className="rounded-xl border border-orange-200 bg-white p-3 shadow-xl print:hidden dark:border-orange-900 dark:bg-neutral-900"
            >
              <p className="mb-1.5 text-[10px] font-medium text-orange-700 dark:text-orange-300">
                {lang === "ko" ? "텍스트 변경 제안" : "Suggest a text change"}
              </p>
              <p className="mb-1 text-[10px] text-neutral-500">
                {lang === "ko" ? "원문:" : "Original:"}
              </p>
              <p className="mb-2 line-clamp-3 rounded bg-neutral-50 px-2 py-1 text-[10px] italic text-neutral-500 dark:bg-neutral-800">
                &ldquo;{paraSuggestSelectedText}&rdquo;
              </p>
              <p className="mb-1 text-[10px] text-neutral-500">
                {lang === "ko" ? "대체 텍스트:" : "Replace with:"}
              </p>
              <textarea
                autoFocus
                value={paraSuggestProposedText}
                onChange={(e) => setParaSuggestProposedText(e.target.value)}
                placeholder={lang === "ko" ? "대체 텍스트 입력…" : "Enter replacement text…"}
                rows={3}
                className="w-full rounded-md border border-orange-300 bg-white px-2.5 py-1.5 text-xs focus:border-orange-500 focus:outline-none dark:border-orange-800 dark:bg-neutral-950"
                onKeyDown={(e) => { if (e.key === "Escape") setShowParaSuggestPopover(false); }}
              />
              <textarea
                value={paraSuggestNote}
                onChange={(e) => setParaSuggestNote(e.target.value)}
                placeholder={lang === "ko" ? "설명 (선택)…" : "Note (optional)…"}
                rows={2}
                className="mt-1.5 w-full rounded-md border border-orange-300 bg-white px-2.5 py-1.5 text-xs focus:border-orange-500 focus:outline-none dark:border-orange-800 dark:bg-neutral-950"
              />
              {paraSuggestError && <p className="mt-1 text-[10px] text-red-500">{paraSuggestError}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await submitParaSuggestion();
                    if (ok) {
                      setShowParaSuggestPopover(false);
                      setSelectedText("");
                      setSelectionRect(null);
                      window.getSelection()?.removeAllRanges();
                    }
                  }}
                  disabled={paraSuggestBusy || !paraSuggestProposedText.trim()}
                  className="rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {paraSuggestBusy ? "…" : (lang === "ko" ? "제출" : "Submit")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowParaSuggestPopover(false);
                    setSelectedText("");
                    setSelectionRect(null);
                  }}
                  className="rounded-md border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {lang === "ko" ? "취소" : "Cancel"}
                </button>
              </div>
            </div>
          )}

          {/* Suggest popover: startup only, appears when they click "Suggest edit" on a token */}
          {isStartup && showSuggestPopover && (
            <div
              data-floating-panel
              style={{
                position: "fixed",
                top: selectionRect.bottom + 8,
                left: selectionRect.left,
                width: 280,
                zIndex: 9999,
              }}
              className="rounded-xl border border-orange-200 bg-white p-3 shadow-xl print:hidden dark:border-orange-900 dark:bg-neutral-900"
            >
              {suggestFieldId && (() => {
                const field = sortedFields.find((f) => f.id === suggestFieldId);
                return field ? (
                  <p className="mb-1.5 text-[10px] font-medium text-orange-700 dark:text-orange-300">
                    {lang === "ko" ? "제안 대상:" : "Suggesting for:"}{" "}
                    {pick(field.labelKo, field.labelEn)}
                  </p>
                ) : null;
              })()}
              <input
                autoFocus
                value={suggestValue}
                onChange={(e) => setSuggestValue(e.target.value)}
                placeholder={lang === "ko" ? "제안 값 입력…" : "Proposed value…"}
                className="w-full rounded-md border border-orange-300 bg-white px-2.5 py-1.5 text-xs focus:border-orange-500 focus:outline-none dark:border-orange-800 dark:bg-neutral-950"
                onKeyDown={(e) => { if (e.key === "Escape") setShowSuggestPopover(false); }}
              />
              <textarea
                value={suggestNote}
                onChange={(e) => setSuggestNote(e.target.value)}
                placeholder={lang === "ko" ? "설명 (선택)…" : "Note (optional)…"}
                rows={2}
                className="mt-1.5 w-full rounded-md border border-orange-300 bg-white px-2.5 py-1.5 text-xs focus:border-orange-500 focus:outline-none dark:border-orange-800 dark:bg-neutral-950"
              />
              {suggestError && <p className="mt-1 text-[10px] text-red-500">{suggestError}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await submitSuggestion();
                    if (ok) {
                      setShowSuggestPopover(false);
                      setSelectedText("");
                      setSelectionRect(null);
                    }
                  }}
                  disabled={suggestBusy || !suggestValue.trim()}
                  className="rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {suggestBusy ? "…" : (lang === "ko" ? "제출" : "Submit")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSuggestPopover(false);
                    setSuggestFieldId(null);
                    setSelectedText("");
                    setSelectionRect(null);
                  }}
                  className="rounded-md border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {lang === "ko" ? "취소" : "Cancel"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
