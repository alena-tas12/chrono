import re
from pathlib import Path
root = Path('main')
for path in root.rglob('*.js'):
    text = path.read_text(encoding='utf-8')
    pattern = re.compile(r'db\.prepare\(\`([\s\S]*?)\`\)\s*\.\s*(run|all|get)\s*\(([^)]*?)\)', re.MULTILINE)
    for m in pattern.finditer(text):
        sql = m.group(1)
        method = m.group(2)
        args = [a.strip() for a in re.split(r',\s*(?![^\(]*\))', m.group(3)) if a.strip()]
        placeholders = sql.count('?')
        if method == 'run':
            arg_count = len(args)
        else:
            # .all or .get may take arguments or none
            arg_count = len(args)
        if placeholders and placeholders != arg_count:
            print(path, 'method', method, 'placeholders', placeholders, 'args', arg_count)
            print('SQL:', sql)
            print('ARGS:', args)
            print('---')
print('done')
