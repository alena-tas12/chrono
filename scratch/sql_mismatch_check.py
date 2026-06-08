import re
from pathlib import Path
root = Path('main')
for path in root.rglob('*.js'):
    text = path.read_text(encoding='utf-8')
    for m in re.finditer(r'db\.prepare\(`([\s\S]*?)`\)\.run\(([^)]*)\)', text):
        sql = m.group(1)
        args = [a.strip() for a in m.group(2).split(',') if a.strip()]
        placeholders = sql.count('?')
        if placeholders != len(args):
            print(path, 'placeholders', placeholders, 'args', len(args))
            print('SQL:', sql)
            print('ARGS:', args)
            print('---')
print('done')
