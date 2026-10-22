"""Generate the bundled dictionary from the pinned, checksum-verified ECDICT CSV.

Usage: python3 scripts/build-local-dictionary.py /path/to/ecdict.csv /path/to/LICENSE
Sources and inclusion rules are recorded in public/dictionary/metadata.json.
"""
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

COMMIT = "bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b"
SHA256 = "1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf"
source, license_file = map(Path, sys.argv[1:3])
if hashlib.sha256(source.read_bytes()).hexdigest() != SHA256:
    raise SystemExit("ECDICT source checksum mismatch; refusing to generate data")

output = Path(__file__).resolve().parents[1] / "public" / "dictionary"
output.mkdir(parents=True, exist_ok=True)
groups = {letter: {} for letter in "abcdefghijklmnopqrstuvwxyz"}
with source.open(encoding="utf-8", newline="") as handle:
    for row in csv.DictReader(handle):
        word = row["word"].strip().lower()
        if not re.fullmatch(r"[a-z]+(?:[ '-][a-z]+)*", word) or len(word) > 100:
            continue
        chinese = row["translation"].replace("\\\\n", "\n").replace("\\n", "\n").strip()
        if not chinese:
            continue
        ranks = [int(row[key]) for key in ["bnc", "frq"] if row[key].isdigit() and int(row[key]) > 0]
        if not (any(rank <= 50000 for rank in ranks) or row["tag"].strip() or re.search(r"陶瓷|釉|瓷土|瓷器|烧结|坯", chinese)):
            continue
        definition = row["definition"].replace("\\\\n", "\n").replace("\\n", "\n").strip()
        # Compact tuples reduce download size. No accent or example is invented.
        groups[word[0]][word] = [chinese[:10000], row["phonetic"].strip(), definition[:12000]]

total = 0
for letter, entries in groups.items():
    total += len(entries)
    content = json.dumps(dict(sorted(entries.items())), ensure_ascii=False, separators=(",", ":")) + "\n"
    if len(content.encode()) > 2 * 1024 * 1024:
        raise SystemExit(f"{letter}.json exceeds the service-worker precache limit")
    (output / f"{letter}.json").write_text(content, encoding="utf-8")
(output / "LICENSE.txt").write_bytes(license_file.read_bytes())
(output / "metadata.json").write_text(json.dumps({
    "name": "ECDICT", "source": "https://github.com/skywind3000/ECDICT", "commit": COMMIT,
    "sourceSha256": SHA256, "license": "MIT", "entries": total,
    "selection": "BNC or COCA frequency rank <= 50000, or study tags, or ceramic terminology; ASCII English words and phrases only",
    "phonetics": "General source transcription only; no US/UK accent is inferred",
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Generated {total:,} entries, {sum(p.stat().st_size for p in output.glob('*.json')):,} bytes")
