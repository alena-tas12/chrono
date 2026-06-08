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


def find_matching_paren(text, start_index):
    depth = 0
    in_string = False
    string_char = None
    escape = False
    for i in range(start_index, len(text)):
        char = text[i]
        if escape:
            escape = False
            continue
        if in_string:
            if char == '\\':
                escape = True
            elif char == string_char:
                in_string = False
            continue
        if char in ('"', "'", '`'):
            in_string = True
            string_char = char
            continue
        if char == '(':
            depth += 1
            continue
        if char == ')':
            depth -= 1
            if depth == 0:
                return i
    return -1


def find_mismatches(path):
    text = path.read_text(encoding='utf-8')
    mismatches = []
    for match in re.finditer(r'db\.prepare\(', text):
        start = match.start()
        # find closing backtick for SQL template
        bt1 = text.find('`', start)
        if bt1 == -1:
            continue
        bt2 = text.find('`', bt1 + 1)
        if bt2 == -1:
            continue
        sql = text[bt1+1:bt2]
        # find next .run or .all or .get after bt2
        after = text.find('.', bt2)
        if after == -1:
            continue
        m2 = re.match(r'\.\s*(run|all|get)\s*\(', text[after:])
        if not m2:
            continue
        method = m2.group(1)
        arg_start = after + m2.end() - 1
        arg_end = find_matching_paren(text, arg_start)
        if arg_end == -1:
            continue
        args_text = text[arg_start+1:arg_end]
        args = split_js_args(args_text)
        placeholders = sql.count('?')
        arg_count = len([a for a in args if a != ''])
        if placeholders != arg_count:
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
