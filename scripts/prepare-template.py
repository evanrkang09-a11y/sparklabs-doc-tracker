"""Turn the mentor's contract into a template the website can fill.

Run once, offline. The output goes in the repository.

Why this exists: Word splits a single placeholder across several runs, so
"[이억이천사백사만육천칠백육십]" is stored as half a dozen fragments. Filling
that at runtime would mean reassembling runs on every request, which is fiddly
and risks corrupting a legal document. Instead this does the fiddly part once
and writes out a template where every placeholder is exactly one run holding a
{{token}} - after which filling is a plain string replace.

It also drops the yellow highlight, so a completed agreement doesn't come out
covered in editing marks.

Re-run this when the mentor sends a revised contract:

  python scripts/prepare-template.py <new-contract.docx> \
      templates/investment-agreement.docx templates/agreement-manifest.json

Then check the token count against lib/agreement-fields.ts with
`npx tsx scripts/check-agreement-fields.mts` - a revised contract can add or
remove placeholders, which shifts the numbering the field map depends on.
"""

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{W_NS}}}"
ET.register_namespace("w", W_NS)

source, out_docx, out_manifest = (Path(p) for p in sys.argv[1:4])

with zipfile.ZipFile(source) as archive:
    parts = {name: archive.read(name) for name in archive.namelist()}

root = ET.fromstring(parts["word/document.xml"].decode("utf-8"))

bracket = re.compile(r"\[[^\[\]]{0,60}\]")

manifest = []
counter = 0


def run_texts(run):
    """The <w:t> elements of a run, in order."""
    return list(run.iter(f"{W}t"))


def is_highlighted(run):
    props = run.find(f"{W}rPr")
    if props is None:
        return False
    hl = props.find(f"{W}highlight")
    return hl is not None and hl.get(f"{W}val") not in (None, "none")


def clear_highlight(run):
    props = run.find(f"{W}rPr")
    if props is None:
        return
    for hl in props.findall(f"{W}highlight"):
        props.remove(hl)


for p_index, paragraph in enumerate(root.iter(f"{W}p")):
    runs = [r for r in paragraph.iter(f"{W}r") if run_texts(r)]
    if not runs or not any(is_highlighted(r) for r in runs):
        continue

    # Flat list of (text element, text) so a span can be located across runs.
    cells = []
    for run in runs:
        for node in run_texts(run):
            cells.append({"node": node, "run": run, "text": node.text or ""})

    full = "".join(cell["text"] for cell in cells)
    spans = [m.span() for m in bracket.finditer(full)]

    if not spans:
        # A highlighted paragraph with no brackets: the highlighted run itself
        # is the value (e.g. "대표이사 : 김유진").
        for run in runs:
            if not is_highlighted(run):
                continue
            nodes = run_texts(run)
            sample = "".join(n.text or "" for n in nodes).strip()
            if not sample:
                continue

            counter += 1
            token = f"{{{{f{counter}}}}}"
            nodes[0].text = token
            nodes[0].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
            for extra in nodes[1:]:
                extra.text = ""

            manifest.append(
                {"token": f"f{counter}", "sample": sample, "context": full.strip(),
                 "paragraph": p_index}
            )
        for run in runs:
            clear_highlight(run)
        continue

    # Right to left, so replacing one span doesn't shift the others.
    for start, end in reversed(spans):
        sample = full[start:end]

        counter_here = None
        offset = 0
        touched = []

        for cell in cells:
            cell_start = offset
            cell_end = offset + len(cell["text"])
            offset = cell_end

            if cell_end <= start or cell_start >= end:
                continue
            touched.append((cell, cell_start, cell_end))

        if not touched:
            continue

        counter += 1
        counter_here = counter
        token = f"{{{{f{counter_here}}}}}"

        # The first touched cell keeps the text before the span, then the token;
        # every other touched cell loses the overlapped portion. Formatting
        # outside the placeholder is untouched.
        for position, (cell, cell_start, cell_end) in enumerate(touched):
            before = cell["text"][: max(0, start - cell_start)]
            after = cell["text"][max(0, end - cell_start) :]

            cell["text"] = (before + token + after) if position == 0 else (before + after)
            cell["node"].text = cell["text"]
            cell["node"].set(
                "{http://www.w3.org/XML/1998/namespace}space", "preserve"
            )

        full = full[:start] + token + full[end:]

        manifest.append(
            {
                "token": f"f{counter_here}",
                "sample": sample,
                "context": "".join(c["text"] for c in cells).strip(),
                "paragraph": p_index,
            }
        )

    for run in runs:
        clear_highlight(run)

# --------------------------------------------------------------------------
# Second pass: the years.
#
# The template writes the year as literal text - "2026년 [*]월 [*]일", and
# "202X년" for the financial statements - so it was never highlighted and the
# first pass left it alone. That locks every agreement to 2026, so the years
# get tokenised too.
#
# Done as a separate pass on purpose: it appends tokens after the 77 the first
# pass created, so the existing numbering (and the field map built on it) stays
# stable instead of shifting by one everywhere.
year_pattern = re.compile(r"202[0-9X]")

for p_index, paragraph in enumerate(root.iter(f"{W}p")):
    cells = []
    for run in paragraph.iter(f"{W}r"):
        for node in run.iter(f"{W}t"):
            cells.append({"node": node, "text": node.text or ""})

    if not cells:
        continue

    full = "".join(cell["text"] for cell in cells)

    # Only paragraphs that already carry a date token - those are the dates.
    # Any other 2026 in the contract is prose, not a field.
    if "{{f" not in full:
        continue

    spans = [m.span() for m in year_pattern.finditer(full)]
    if not spans:
        continue

    for start, end in reversed(spans):
        sample = full[start:end]

        offset = 0
        touched = []
        for cell in cells:
            cell_start = offset
            cell_end = offset + len(cell["text"])
            offset = cell_end
            if cell_end <= start or cell_start >= end:
                continue
            touched.append((cell, cell_start, cell_end))

        if not touched:
            continue

        counter += 1
        token = f"{{{{f{counter}}}}}"

        for position, (cell, cell_start, cell_end) in enumerate(touched):
            before = cell["text"][: max(0, start - cell_start)]
            after = cell["text"][max(0, end - cell_start) :]
            cell["text"] = (before + token + after) if position == 0 else (before + after)
            cell["node"].text = cell["text"]
            cell["node"].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")

        full = full[:start] + token + full[end:]

        manifest.append(
            {
                "token": f"f{counter}",
                "sample": sample,
                "context": "".join(c["text"] for c in cells).strip(),
                "paragraph": p_index,
                "kind": "year",
            }
        )

manifest.sort(key=lambda row: int(row["token"][1:]))

# Sweep every remaining highlight in the document.
#
# Clearing per-run above misses two places: highlighting on a paragraph mark
# (inside <w:pPr><w:rPr>, which is not a run and shows in Word as a yellow block
# at the end of the line) and runs in paragraphs that fell through the field
# logic. A completed contract should carry no editing marks at all, so this
# removes them wherever they live.
swept = 0
for props in root.iter(f"{W}rPr"):
    for hl in props.findall(f"{W}highlight"):
        props.remove(hl)
        swept += 1
print(f"highlights cleared in sweep: {swept}")

parts["word/document.xml"] = ET.tostring(root, encoding="utf-8", xml_declaration=True)

out_docx.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out_docx, "w", zipfile.ZIP_DEFLATED) as archive:
    for name, data in parts.items():
        archive.writestr(name, data)

out_manifest.parent.mkdir(parents=True, exist_ok=True)
out_manifest.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
)

print(f"tokens created: {counter}")
print(f"template: {out_docx}")
print(f"manifest: {out_manifest}")
