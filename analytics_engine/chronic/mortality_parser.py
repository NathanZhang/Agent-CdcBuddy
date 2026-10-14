"""Lossless certificate extraction and category candidates, independent of selection rules."""
import hashlib
import json
import re
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POSITIONS = ['a', 'b', 'c', 'd', 'e', 'part2']
LABEL = re.compile(r'(?:^|[\n;；])\s*(?:第[一1]部分\s*)?(?:[（(]?([a-eA-E])[）).、:：]|(第二部分|第2部分|Part\s*II|II)\s*[:：]?)\s*', re.I)
DURATION = re.compile(r'(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>分钟|小时|个月|年|月|天|日|周|minutes?|hours?|days?|weeks?|months?|years?)', re.I)
CODE = re.compile(r'(?<![A-Za-z0-9])([A-Z][0-9]{2}(?:\.[0-9A-Za-z]{1,6})?)(?![A-Za-z0-9])')


@lru_cache(maxsize=1)
def catalogue():
    source = json.loads((ROOT / 'config/mortality/icd10-categories.json').read_text())
    aliases = json.loads((ROOT / 'config/mortality/aliases.json').read_text())
    entries = {e['code']: e for e in source['entries']}
    terms = {e['label']: [e['code']] for e in source['entries']}
    terms.update(aliases['aliases'])
    return source, entries, sorted(terms.items(), key=lambda item: len(item[0]), reverse=True)


def _lines(input_chain=None, text=None):
    if (input_chain is None) == (text is None):
        raise ValueError('Supply exactly one of inputChain or text')
    issues = []
    if input_chain is not None:
        if not isinstance(input_chain, dict) or set(input_chain) - set(POSITIONS):
            raise ValueError('Invalid certificate positions')
        if any(not isinstance(v, str) for v in input_chain.values()):
            raise ValueError('Certificate lines must be strings')
        rows = [{'position': k, 'text': input_chain[k], 'sourceStart': 0, 'sourceField': k}
                for k in POSITIONS if input_chain.get(k, '').strip()]
    else:
        if not isinstance(text, str) or not text.strip():
            raise ValueError('Empty certificate text')
        labels = list(LABEL.finditer(text))
        rows = []
        if labels:
            if text[:labels[0].start()].strip():
                issues.append('unassigned-text-before-certificate')
            used = set()
            for i, match in enumerate(labels):
                key = match[1].lower() if match[1] else 'part2'
                if key in used:
                    issues.append('duplicate-certificate-position')
                used.add(key)
                stop = labels[i + 1].start() if i + 1 < len(labels) else len(text)
                rows.append({'position': key, 'text': text[match.end():stop], 'sourceStart': match.end(), 'sourceField': 'text'})
        elif '→' in text or '->' in text:
            parts = list(re.finditer(r'[^→]+?(?=→|$)', text)) if '→' in text else list(re.finditer(r'.+?(?=->|$)', text))
            # Only the explicit terminal-to-origin arrow convention is accepted here.
            if len(parts) > 5:
                raise ValueError('At most five Part I lines are supported')
            for i, part in enumerate(parts):
                value = part.group().removeprefix('->')
                rows.append({'position': POSITIONS[i], 'text': value, 'sourceStart': part.start() + (2 if part.group().startswith('->') else 0), 'sourceField': 'text'})
            issues.append('arrow-order-requires-review')
        else:
            rows = [{'position': 'a', 'text': text, 'sourceStart': 0, 'sourceField': 'text'}]
            if re.search(r'导致|引起|由于|死于|继发于|\n', text):
                issues.append('unstructured-causal-order-requires-review')
    if not rows or sum(len(r['text']) for r in rows) > 12000 or any(len(r['text']) > 4000 for r in rows):
        raise ValueError('Certificate is empty or exceeds the input budget')
    populated = [POSITIONS.index(r['position']) for r in rows if r['position'] != 'part2']
    if not populated:
        issues.append('missing-part-one')
    elif sorted(set(populated)) != list(range(max(populated) + 1)):
        issues.append('gap-in-part-one')
    return rows, issues


def parse_certificate(input_chain=None, text=None):
    rows, issues = _lines(input_chain, text)
    source, entries, terms = catalogue()
    for row in rows:
        raw = row['text']
        entities = []
        occupied = set()
        for term, codes in terms:
            for found in re.finditer(re.escape(term), raw):
                if any(p in occupied for p in range(found.start(), found.end())):
                    continue
                occupied.update(range(found.start(), found.end()))
                clause_start = max([raw.rfind(c, 0, found.start()) for c in '，,；;。\n'] + [-1]) + 1
                prefix = raw[clause_start:found.start()]
                suffix = raw[found.end():].split('，')[0].split(';')[0]
                uncertain = bool(re.search(r'疑似|考虑|可能|待排|未排除|不能排除|不除外|\?|？', prefix + suffix))
                negated = not uncertain and bool(re.search(r'否认|未见|排除|无(?:明确)?|not\s+|no\s+', prefix, re.I))
                assertion = 'negated' if negated else 'uncertain' if uncertain else 'reported'
                entities.append({'text': found.group(), 'start': row['sourceStart'] + found.start(),
                                 'end': row['sourceStart'] + found.end(), 'sourceField': row['sourceField'],
                                 'assertion': assertion, 'candidateCodes': codes,
                                 'candidates': [entries[c] for c in codes if c in entries],
                                 'granularity': 'three-character-category', 'requiresReview': True})
                if assertion != 'reported':
                    issues.append('non-affirmed-diagnosis')
                if len(codes) > 1:
                    issues.append('ambiguous-category')
        entities.sort(key=lambda e: e['start'])
        explicit = []
        for match in CODE.finditer(raw):
            value = match[1]
            valid_category = value[:3] in entries
            if not valid_category or ('.' in value and len(value.split('.')[1]) > 1):
                issues.append('unsupported-code-or-national-extension')
            explicit.append({'code': value, 'start': row['sourceStart'] + match.start(),
                             'end': row['sourceStart'] + match.end(), 'categoryKnown': valid_category,
                             'terminalCodeValidated': False})
        durations = [{'text': m.group(), 'value': float(m['value']), 'unit': m['unit'],
                      'start': row['sourceStart'] + m.start(), 'end': row['sourceStart'] + m.end()}
                     for m in DURATION.finditer(raw)]
        if not entities and not explicit:
            issues.append('unmapped-diagnosis')
        row.update(entities=entities, explicitCodes=explicit, durations=durations)
    # No entity is declared to be the underlying cause merely because it is last.
    signature = {'inputChain': input_chain, 'text': text}
    return {'version': 'mortality-certificate-parser-v2', 'rows': rows,
            'issues': list(dict.fromkeys(issues)), 'originalInput': signature,
            'inputSha256': hashlib.sha256(json.dumps(signature, ensure_ascii=False, sort_keys=True).encode()).hexdigest(),
            'catalogue': {k: source[k] for k in ['version', 'classification', 'granularity', 'sourceFile', 'sourceSha256', 'sourceSheet', 'sourceEdition']},
            'categoryCount': len(entries)}
