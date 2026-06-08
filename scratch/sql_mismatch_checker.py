import re
from pathlib import Path

# parse top-level comma-separated arguments in JS parentheses

def split_js_args(arg_text):
    args = []
    current = ''
    depth = 0
    in_string = False
    string_char = None
    escape = False
    for char in arg_text:
        if escape:
            current += char
            escape = False
            continue
        if in_string:
            current += char
            if char == '\\':
                escape = True
            elif char == string_char:
                in_string = False
            continue
        if char in ('"', "'", '`'):
            in_string = True
            string_char = char
            current += char
            continue
        if char == '(':
            depth += 1
            current += char
            continue
        if char == ')':
            if depth > 0:
                depth -= 1
            current += char
            continue
        if char == ',' and depth == 0:
            args.append(current.strip())
            current = ''
            continue
        current += char
    if current.strip() != '':
        args.append(current.strip())
    return args


def find_mismatches(path):
    text = path.read_text(encoding='utf-8')
    pattern = re.compile(r'db\.prepare\(\`([\s\S]*?)\`\)\s*\.\s*(run|all|get)\s*\(([\s\S]*?)\)', re.MULTILINE)
    mismatches = []
    for m in pattern.finditer(text):
        sql = m.group(1)
        method = m.group(2)
        args_text = m.group(3)
        args = split_js_args(args_text)
        placeholders = sql.count('?')
        arg_count = len(args)
        if method == 'run' and placeholders != arg_count:
            mismatches.append((path, method, placeholders, arg_count, sql, args))
        if method in ('get','all') and placeholders != arg_count:
            mismatches.append((path, method, placeholders, arg_count, sql, args))
    return mismatches


for path in Path('main').rglob('*.js'):
    mismatches = find_mismatches(path)
    for m in mismatches:
        print(m[0], 'method', m[1], 'placeholders', m[2], 'args', m[3])
        print('SQL:', m[4])
        print('ARGS:', m[5])
        print('---')
print('done')
