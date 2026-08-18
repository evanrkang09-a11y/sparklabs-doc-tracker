/**
 * Reads a .docx into something the browser can draw faithfully.
 *
 * The preview used to be plain text, which threw away everything that makes a
 * contract legible: the centred cover, the article numbers, bold defined terms,
 * the tables, the indentation that shows which sub-clause belongs to which
 * clause. This keeps that.
 *
 * Deliberately not a general Word renderer - it covers what this contract
 * actually contains (surveyed with scripts/survey-formatting.mts): paragraphs,
 * runs, list numbering, tables, page breaks. Anything else is ignored rather
 * than approximated.
 *
 * One thing it cannot reproduce: Word decides where pages end by measuring
 * text. This renders one continuous sheet at the right width and margins, and
 * marks the three EXPLICIT page breaks. So the layout is faithful; the
 * pagination is not, and the .docx download remains the real document.
 */

import {
  childNamed,
  childrenNamed,
  descendantsNamed,
  isOn,
  parseXml,
  valOf,
  type XmlNode,
} from "./xml";

/** Word measures in twentieths of a point. */
const TWIPS_PER_POINT = 20;

function points(twips: string | undefined): number | undefined {
  if (twips === undefined) return undefined;
  const parsed = Number(twips);
  return Number.isFinite(parsed) ? parsed / TWIPS_PER_POINT : undefined;
}

/** Font sizes are in half-points. */
function halfPoints(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 2 : undefined;
}

export type Run = {
  text: string;
  /** Set when this run is a fillable slot: the token id, e.g. "f27". */
  token?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  sizePt?: number;
  /** Only when the document sets something other than black. */
  color?: string;
};

export type Paragraph = {
  kind: "paragraph";
  runs: Run[];
  align?: "left" | "center" | "right" | "justify";
  /** Left indent, in points. */
  indentPt?: number;
  /** First line offset relative to the indent - negative for a hanging indent. */
  firstLinePt?: number;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  /** Line height as a multiple of the font size, when the document sets one. */
  lineHeight?: number;
  /** A page break falls before this paragraph. */
  pageBreak?: boolean;
  /** The resolved list number, e.g. "제3조" or "1." - not part of the text. */
  marker?: string;
  markerSizePt?: number;
};

export type Cell = {
  blocks: Block[];
  /** Column span. */
  span: number;
  /** Width as a percentage of the table, when the document gives one. */
  widthPct?: number;
};

export type Table = {
  kind: "table";
  rows: Cell[][];
  bordered: boolean;
};

export type Block = Paragraph | Table;

export type PageSetup = {
  widthPt: number;
  heightPt: number;
  marginTopPt: number;
  marginRightPt: number;
  marginBottomPt: number;
  marginLeftPt: number;
};

export type DocxLayout = {
  blocks: Block[];
  page: PageSetup;
  /** The document's base font size, applied where a run doesn't set one. */
  defaultSizePt: number;
};

// ---------------------------------------------------------------------------
// List numbering
//
// The contract's article numbers ("제1조") and clause numbers ("1.", "가.") are
// NOT text in the document - they're generated from numbering.xml. A preview
// without them loses most of a contract's structure, so they get resolved here
// the way Word would.

type Level = {
  start: number;
  format: string;
  /** e.g. "제%1조", "%1.", "%1.%2" */
  pattern: string;
  indentPt?: number;
  firstLinePt?: number;
  sizePt?: number;
};

type Numbering = {
  /** numId -> level index -> definition */
  levels: Map<string, Map<number, Level>>;
};

function readLevel(node: XmlNode): Level {
  const properties = childNamed(node, "w:pPr");
  const indent = properties ? childNamed(properties, "w:ind") : undefined;
  const runProperties = childNamed(node, "w:rPr");

  const left = points(indent?.attrs["w:left"]);
  const hanging = points(indent?.attrs["w:hanging"]);
  const firstLine = points(indent?.attrs["w:firstLine"]);

  return {
    start: Number(valOf(node, "w:start") ?? "1") || 1,
    format: valOf(node, "w:numFmt") ?? "decimal",
    pattern: valOf(node, "w:lvlText") ?? "%1.",
    indentPt: left,
    firstLinePt: hanging !== undefined ? -hanging : firstLine,
    sizePt: runProperties ? halfPoints(valOf(runProperties, "w:sz")) : undefined,
  };
}

function readNumbering(xml: string | undefined): Numbering {
  const levels = new Map<string, Map<number, Level>>();
  if (!xml) return { levels };

  const root = parseXml(xml);
  const numbering = childNamed(root, "w:numbering");
  if (!numbering) return { levels };

  // abstractNumId -> levels
  const abstract = new Map<string, Map<number, Level>>();
  for (const node of childrenNamed(numbering, "w:abstractNum")) {
    const id = node.attrs["w:abstractNumId"];
    if (!id) continue;

    const byLevel = new Map<number, Level>();
    for (const level of childrenNamed(node, "w:lvl")) {
      const index = Number(level.attrs["w:ilvl"] ?? "0");
      if (Number.isFinite(index)) byLevel.set(index, readLevel(level));
    }
    abstract.set(id, byLevel);
  }

  for (const node of childrenNamed(numbering, "w:num")) {
    const numId = node.attrs["w:numId"];
    const abstractId = valOf(node, "w:abstractNumId");
    if (!numId || abstractId === undefined) continue;

    const base = abstract.get(abstractId);
    if (!base) continue;

    // A numId can restart a level at a different number than the shared
    // abstract definition says - that's how Word represents "this list starts
    // again at 1" without duplicating the whole definition.
    const merged = new Map(base);
    for (const override of childrenNamed(node, "w:lvlOverride")) {
      const index = Number(override.attrs["w:ilvl"] ?? "0");
      const start = valOf(override, "w:startOverride");
      const replacement = childNamed(override, "w:lvl");

      if (replacement) merged.set(index, readLevel(replacement));
      else if (start !== undefined) {
        const existing = merged.get(index);
        if (existing) merged.set(index, { ...existing, start: Number(start) || 1 });
      }
    }

    levels.set(numId, merged);
  }

  return { levels };
}

const UPPER_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ROMAN: [number, string][] = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
];

/** Korean ordinals, used by ganada-style lists. */
const GANADA = "가나다라마바사아자차카타파하";

function toRoman(value: number): string {
  let left = value;
  let out = "";

  for (const [size, numeral] of ROMAN) {
    while (left >= size) {
      out += numeral;
      left -= size;
    }
  }

  return out;
}

function formatNumber(value: number, format: string): string {
  switch (format) {
    case "decimal":
      return String(value);
    case "upperLetter":
      return UPPER_LETTERS[(value - 1) % 26] ?? String(value);
    case "lowerLetter":
      return (UPPER_LETTERS[(value - 1) % 26] ?? String(value)).toLowerCase();
    case "upperRoman":
      return toRoman(value).toUpperCase();
    case "lowerRoman":
      return toRoman(value);
    case "ganada":
      return GANADA[(value - 1) % GANADA.length] ?? String(value);
    case "decimalEnclosedCircle":
      // ① is U+2460. Beyond 20 there is no circled digit, so fall back.
      return value >= 1 && value <= 20 ? String.fromCodePoint(0x245f + value) : String(value);
    case "bullet":
      return "·";
    case "none":
      return "";
    default:
      return String(value);
  }
}

/** Keeps the running count for every list in the document. */
class Counters {
  private readonly counts = new Map<string, number[]>();

  constructor(private readonly numbering: Numbering) {}

  /** Advances the given list one step and returns its marker. */
  next(numId: string, level: number): { marker: string; definition: Level } | undefined {
    const definitions = this.numbering.levels.get(numId);
    const definition = definitions?.get(level);
    if (!definitions || !definition) return undefined;

    const counts = this.counts.get(numId) ?? [];
    counts[level] = (counts[level] ?? definition.start - 1) + 1;

    // Starting a sub-list over is what makes "1. a. b. 2. a." work: without the
    // reset the second clause's sub-items would continue from c.
    for (let deeper = level + 1; deeper < counts.length; deeper++) {
      counts[deeper] = (definitions.get(deeper)?.start ?? 1) - 1;
    }

    this.counts.set(numId, counts);

    const marker = definition.pattern.replace(/%(\d)/g, (whole, digit: string) => {
      const index = Number(digit) - 1;
      const at = counts[index];
      if (at === undefined) return whole;

      const format = definitions.get(index)?.format ?? definition.format;
      return formatNumber(at, format);
    });

    return { marker, definition };
  }
}

// ---------------------------------------------------------------------------
// Runs and paragraphs

type RunStyle = Omit<Run, "text" | "token">;

function readRunStyle(properties: XmlNode | undefined): RunStyle {
  if (!properties) return {};

  const color = valOf(properties, "w:color");
  const style: RunStyle = {
    bold: isOn(properties, "w:b"),
    italic: isOn(properties, "w:i"),
    underline: valOf(properties, "w:u") !== undefined && valOf(properties, "w:u") !== "none",
    sizePt: halfPoints(valOf(properties, "w:sz")),
    // "auto" and black are the default; carrying them would mean fighting dark
    // mode for no reason.
    color: color && color !== "auto" && !/^0{6}$/.test(color) ? `#${color}` : undefined,
  };

  // Drop the keys Word didn't set, so an explicit `false` stays meaningful.
  for (const key of Object.keys(style) as (keyof RunStyle)[]) {
    if (style[key] === undefined) delete style[key];
  }

  return style;
}

// Tokens are a short letter prefix plus a number: f27 (CPS), s7 (SAFE), etc.
const SLOT = /\{\{([a-z]{1,4}\d+)\}\}/g;

/**
 * Splits a run's text so every fillable slot is its own run.
 *
 * The slots have to be individually addressable for the screen to scroll to one
 * and highlight it, and they have to keep the surrounding run's formatting -
 * a value dropped into a bold clause should come out bold.
 */
function splitSlots(text: string, style: RunStyle): Run[] {
  const out: Run[] = [];
  let at = 0;

  for (const match of text.matchAll(SLOT)) {
    const start = match.index ?? 0;
    if (start > at) out.push({ text: text.slice(at, start), ...style });
    out.push({ text: match[0], token: match[1], ...style });
    at = start + match[0].length;
  }

  if (at < text.length) out.push({ text: text.slice(at), ...style });
  return out;
}

/**
 * Collects the text of one run, and reports whether it forces a page break.
 *
 * <w:tab/> and <w:br/> are elements rather than characters, so they would
 * vanish if we only read <w:t>.
 */
function readRun(run: XmlNode): { runs: Run[]; pageBreak: boolean } {
  const style = readRunStyle(childNamed(run, "w:rPr"));
  let text = "";
  let pageBreak = false;

  for (const child of run.children) {
    if (child.name === "w:t") text += child.text;
    else if (child.name === "w:tab") text += "\t";
    else if (child.name === "w:br") {
      if (child.attrs["w:type"] === "page") pageBreak = true;
      else text += "\n";
    } else if (child.name === "w:noBreakHyphen") text += "-";
    else if (child.name === "w:softHyphen") text += "";
  }

  return { runs: text ? splitSlots(text, style) : [], pageBreak };
}

/**
 * The runs of a paragraph, in order, descending through wrappers.
 *
 * There are 500 <w:sdt> content controls in this contract - Google Docs leaves
 * them behind on export - and every one wraps runs that must still be read.
 * Same for hyperlinks and smart-tag wrappers.
 */
function collectRuns(node: XmlNode, into: Run[]): boolean {
  let pageBreak = false;

  for (const child of node.children) {
    if (child.name === "w:r") {
      const read = readRun(child);
      into.push(...read.runs);
      pageBreak = pageBreak || read.pageBreak;
      continue;
    }

    // Anything that can contain runs but isn't one. w:pPr is skipped so
    // paragraph-mark formatting doesn't turn into text.
    if (
      child.name === "w:sdt" ||
      child.name === "w:sdtContent" ||
      child.name === "w:hyperlink" ||
      child.name === "w:smartTag" ||
      child.name === "w:ins" ||
      child.name === "w:bdo" ||
      child.name === "w:dir"
    ) {
      pageBreak = collectRuns(child, into) || pageBreak;
    }
  }

  return pageBreak;
}

function readParagraph(node: XmlNode, counters: Counters): Paragraph {
  const properties = childNamed(node, "w:pPr");
  const runs: Run[] = [];
  const brokeHere = collectRuns(node, runs);

  const paragraph: Paragraph = { kind: "paragraph", runs };
  if (brokeHere) paragraph.pageBreak = true;

  if (!properties) return paragraph;

  const align = valOf(properties, "w:jc");
  if (align === "center" || align === "right" || align === "left") paragraph.align = align;
  else if (align === "both" || align === "distribute") paragraph.align = "justify";

  const indent = childNamed(properties, "w:ind");
  if (indent) {
    paragraph.indentPt = points(indent.attrs["w:left"] ?? indent.attrs["w:start"]);

    const hanging = points(indent.attrs["w:hanging"]);
    const firstLine = points(indent.attrs["w:firstLine"]);
    if (hanging !== undefined) paragraph.firstLinePt = -hanging;
    else if (firstLine !== undefined) paragraph.firstLinePt = firstLine;
  }

  const spacing = childNamed(properties, "w:spacing");
  if (spacing) {
    paragraph.spaceBeforePt = points(spacing.attrs["w:before"]);
    paragraph.spaceAfterPt = points(spacing.attrs["w:after"]);

    // "auto" line spacing is a multiplier in 240ths; "exact"/"atLeast" are
    // absolute and are left to the browser rather than faked.
    const line = spacing.attrs["w:line"];
    const rule = spacing.attrs["w:lineRule"];
    if (line && (rule === undefined || rule === "auto")) {
      const multiple = Number(line) / 240;
      if (Number.isFinite(multiple) && multiple > 0) paragraph.lineHeight = multiple;
    }
  }

  if (isOn(properties, "w:pageBreakBefore")) paragraph.pageBreak = true;

  const listProperties = childNamed(properties, "w:numPr");
  if (listProperties) {
    const numId = valOf(listProperties, "w:numId");
    const level = Number(valOf(listProperties, "w:ilvl") ?? "0") || 0;

    if (numId && numId !== "0") {
      const numbered = counters.next(numId, level);
      if (numbered) {
        paragraph.marker = numbered.marker;
        paragraph.markerSizePt = numbered.definition.sizePt;

        // The list definition supplies the indentation unless the paragraph
        // overrides it - that's what lines sub-clauses up under their parent.
        paragraph.indentPt ??= numbered.definition.indentPt;
        paragraph.firstLinePt ??= numbered.definition.firstLinePt;
      }
    }
  }

  return paragraph;
}

// ---------------------------------------------------------------------------
// Tables

function readTable(node: XmlNode, counters: Counters): Table {
  const properties = childNamed(node, "w:tblPr");
  const borders = properties ? childNamed(properties, "w:tblBorders") : undefined;

  // The grid gives column widths; turning them into percentages keeps the table
  // proportioned when the preview is narrower than a page.
  const grid = childNamed(node, "w:tblGrid");
  const columns = grid
    ? childrenNamed(grid, "w:gridCol").map((column) => Number(column.attrs["w:w"] ?? "0"))
    : [];
  const total = columns.reduce((sum, width) => sum + width, 0);

  const rows: Cell[][] = [];

  for (const row of childrenNamed(node, "w:tr")) {
    const cells: Cell[] = [];
    let column = 0;

    for (const cell of childrenNamed(row, "w:tc")) {
      const cellProperties = childNamed(cell, "w:tcPr");
      const span = Number(
        (cellProperties && valOf(cellProperties, "w:gridSpan")) || "1",
      ) || 1;

      const width =
        total > 0
          ? (columns.slice(column, column + span).reduce((sum, w) => sum + w, 0) / total) * 100
          : undefined;

      cells.push({ blocks: readBlocks(cell, counters), span, widthPct: width });
      column += span;
    }

    rows.push(cells);
  }

  return {
    kind: "table",
    rows,
    // No <w:tblBorders> at all means the table is a layout device (the
    // signature blocks use one), and drawing lines round it would invent
    // structure the contract doesn't have.
    bordered: borders !== undefined && valOf(borders, "w:top") !== "none",
  };
}

function readBlocks(node: XmlNode, counters: Counters): Block[] {
  const blocks: Block[] = [];

  for (const child of node.children) {
    if (child.name === "w:p") blocks.push(readParagraph(child, counters));
    else if (child.name === "w:tbl") blocks.push(readTable(child, counters));
    else if (child.name === "w:sdt" || child.name === "w:sdtContent") {
      blocks.push(...readBlocks(child, counters));
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------

const A4: PageSetup = {
  widthPt: 595.3,
  heightPt: 841.9,
  marginTopPt: 85,
  marginRightPt: 72,
  marginBottomPt: 72,
  marginLeftPt: 72,
};

function readPageSetup(body: XmlNode): PageSetup {
  // The last sectPr in the body describes the document's main section.
  const sections = descendantsNamed(body, "w:sectPr");
  const section = sections[sections.length - 1];
  if (!section) return A4;

  const size = childNamed(section, "w:pgSz");
  const margin = childNamed(section, "w:pgMar");

  return {
    widthPt: points(size?.attrs["w:w"]) ?? A4.widthPt,
    heightPt: points(size?.attrs["w:h"]) ?? A4.heightPt,
    marginTopPt: points(margin?.attrs["w:top"]) ?? A4.marginTopPt,
    marginRightPt: points(margin?.attrs["w:right"]) ?? A4.marginRightPt,
    marginBottomPt: points(margin?.attrs["w:bottom"]) ?? A4.marginBottomPt,
    marginLeftPt: points(margin?.attrs["w:left"]) ?? A4.marginLeftPt,
  };
}

function readDefaultSize(stylesXml: string | undefined): number {
  if (!stylesXml) return 10;

  const root = parseXml(stylesXml);
  const styles = childNamed(root, "w:styles");
  const defaults = styles ? childNamed(styles, "w:docDefaults") : undefined;
  const runDefaults = defaults ? childNamed(defaults, "w:rPrDefault") : undefined;
  const properties = runDefaults ? childNamed(runDefaults, "w:rPr") : undefined;

  return (properties ? halfPoints(valOf(properties, "w:sz")) : undefined) ?? 10;
}

/**
 * Turns the .docx parts into a drawable layout.
 *
 * `parts` is the unzipped archive, so the caller can reuse an already-open
 * template rather than reading 2MB again.
 */
export function readLayout(parts: Record<string, Uint8Array>): DocxLayout {
  const decoder = new TextDecoder();
  const document = parts["word/document.xml"];
  if (!document) throw new Error("word/document.xml is missing from the template");

  const numbering = readNumbering(
    parts["word/numbering.xml"] ? decoder.decode(parts["word/numbering.xml"]) : undefined,
  );

  const root = parseXml(decoder.decode(document));
  const body = childNamed(childNamed(root, "w:document") ?? root, "w:body");
  if (!body) throw new Error("word/document.xml has no <w:body>");

  return {
    blocks: readBlocks(body, new Counters(numbering)),
    page: readPageSetup(body),
    defaultSizePt: readDefaultSize(
      parts["word/styles.xml"] ? decoder.decode(parts["word/styles.xml"]) : undefined,
    ),
  };
}
