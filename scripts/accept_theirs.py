import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {'.git', '.venv', 'node_modules'}

def file_has_conflict(path: Path) -> bool:
    try:
        s = path.read_text(encoding='utf-8')
    except Exception:
        return False
    return '<<<<<<<' in s and '>>>>>>>' in s

def process_file(path: Path):
    text = path.read_text(encoding='utf-8')
    lines = text.splitlines(keepends=True)
    out = []
    i = 0
    changed = False
    while i < len(lines):
        line = lines[i]
        if line.startswith('<<<<<<<'):
            # skip ours until =======
            i += 1
            while i < len(lines) and not lines[i].startswith('======='):
                i += 1
            # skip '======='
            i += 1
            # collect theirs until >>>>>>>>
            while i < len(lines) and not lines[i].startswith('>>>>>>>'):
                out.append(lines[i])
                i += 1
            # skip >>>>>>>>
            if i < len(lines) and lines[i].startswith('>>>>>>>'):
                i += 1
            changed = True
        else:
            out.append(line)
            i += 1
    if changed:
        path.write_text(''.join(out), encoding='utf-8')
        print(f'Updated: {path}')
    return changed


def main():
    changed_any = False
    for dirpath, dirnames, filenames in os.walk(ROOT):
        # prune
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            p = Path(dirpath) / fname
            if file_has_conflict(p):
                try:
                    ok = process_file(p)
                    if ok:
                        changed_any = True
                except Exception as e:
                    print('Error processing', p, e)
    if not changed_any:
        print('No conflict markers found.')

if __name__ == '__main__':
    main()
