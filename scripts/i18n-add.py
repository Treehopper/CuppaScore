#!/usr/bin/env python3
"""Adds/overwrites i18n keys in all locales at once (dev tool).

stdin, one key per line, fields separated by ' | ':
    key.path | English | Deutsch | Italiano | Español
Keeps key order of existing files; new keys are appended to their namespace.
"""
import json, sys, pathlib

DIR = pathlib.Path(__file__).resolve().parent.parent / 'apps' / 'pwa' / 'src' / 'i18n'
LOCS = ['en', 'de', 'it', 'es']
data = {l: json.loads((DIR / f'{l}.json').read_text()) for l in LOCS}

n = 0
for line in sys.stdin:
    line = line.rstrip('\n')
    if not line.strip() or line.lstrip().startswith('#'):
        continue
    parts = [p.strip() for p in line.split(' | ')]
    if len(parts) != 5:
        sys.exit(f'need 5 fields: {line!r}')
    key, *texts = parts
    for loc, text in zip(LOCS, texts):
        cur = data[loc]
        *path, leaf = key.split('.')
        for p in path:
            cur = cur.setdefault(p, {})
        cur[leaf] = text
    n += 1

for l in LOCS:
    (DIR / f'{l}.json').write_text(json.dumps(data[l], ensure_ascii=False, indent=2) + '\n')
print(f'i18n-add: {n} keys')
