/**
 * A small XML reader, enough for the parts of a .docx we care about.
 *
 * Why hand-written rather than a library: the whole point of this project is
 * handling confidential company documents, so every dependency added is
 * something that gets to see them. OOXML is machine-generated, valid XML with
 * no doctypes or processing quirks, and we only need elements, attributes and
 * text - which is a small enough job to own outright.
 *
 * It is NOT a general XML parser. It does not validate, resolve namespaces, or
 * handle CDATA. It reads what Word writes.
 */

export type XmlNode = {
  /** Tag name exactly as written, prefix included: "w:p", "w:tbl". */
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  /** Text directly inside this element, entities already decoded. */
  text: string;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) {
      return String.fromCodePoint(parseInt(body.slice(1), 10));
    }
    return ENTITIES[body] ?? whole;
  });
}

const ATTR = /([\w:.-]+)\s*=\s*"([^"]*)"|([\w:.-]+)\s*=\s*'([^']*)'/g;

function parseAttrs(body: string): Record<string, string> {
  const attrs: Record<string, string> = {};

  for (const match of body.matchAll(ATTR)) {
    const name = match[1] ?? match[3];
    const value = match[2] ?? match[4];
    attrs[name] = decodeEntities(value);
  }

  return attrs;
}

/**
 * Parses a document into a tree.
 *
 * Text is attached to the element it sits directly inside. Mixed content - text
 * with elements interleaved - loses the interleaving, which is fine here: in
 * WordprocessingML the text always lives alone inside <w:t>.
 */
export function parseXml(source: string): XmlNode {
  const root: XmlNode = { name: "#document", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];

  let at = 0;

  while (at < source.length) {
    const open = source.indexOf("<", at);

    if (open === -1) break;

    if (open > at) {
      const text = source.slice(at, open);
      const node = stack[stack.length - 1];
      if (text) node.text += decodeEntities(text);
    }

    // Declarations, comments and doctypes carry nothing we need.
    if (source.startsWith("<?", open) || source.startsWith("<!", open)) {
      const close = source.indexOf(">", open);
      if (close === -1) break;
      at = close + 1;
      continue;
    }

    const close = source.indexOf(">", open);
    if (close === -1) break;

    const raw = source.slice(open + 1, close);
    at = close + 1;

    if (raw.startsWith("/")) {
      // Trust the document to be well-formed rather than searching the stack:
      // an unbalanced close would mean the file is corrupt, and silently
      // recovering would hide that.
      if (stack.length > 1) stack.pop();
      continue;
    }

    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const space = body.search(/\s/);
    const name = space === -1 ? body : body.slice(0, space);

    const node: XmlNode = {
      name,
      attrs: space === -1 ? {} : parseAttrs(body.slice(space)),
      children: [],
      text: "",
    };

    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }

  return root;
}

/** Direct children with this tag name. */
export function childrenNamed(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((child) => child.name === name);
}

/** The first direct child with this tag name. */
export function childNamed(node: XmlNode, name: string): XmlNode | undefined {
  return node.children.find((child) => child.name === name);
}

/** Every descendant with this tag name, in document order. */
export function descendantsNamed(node: XmlNode, name: string): XmlNode[] {
  const found: XmlNode[] = [];

  const walk = (current: XmlNode) => {
    for (const child of current.children) {
      if (child.name === name) found.push(child);
      walk(child);
    }
  };

  walk(node);
  return found;
}

/**
 * The `w:val` of a child element - the shape most Word settings take.
 *
 * `<w:jc w:val="center"/>` is a value; `<w:b/>` is a flag whose presence means
 * true, so a missing `w:val` reports as an empty string rather than undefined.
 */
export function valOf(node: XmlNode, name: string): string | undefined {
  const child = childNamed(node, name);
  if (!child) return undefined;
  return child.attrs["w:val"] ?? "";
}

/**
 * Whether a Word on/off property is on.
 *
 * `<w:b/>` and `<w:b w:val="1"/>` are on; `<w:b w:val="0"/>` is explicitly off,
 * which matters because it overrides a style that would otherwise apply.
 */
export function isOn(node: XmlNode, name: string): boolean | undefined {
  const value = valOf(node, name);
  if (value === undefined) return undefined;
  return value !== "0" && value !== "false" && value !== "off";
}
