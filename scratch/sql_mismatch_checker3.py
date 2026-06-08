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


def find_matching_quote(text, start_index, quote_char):
    escaped = False
    for i in range(start_index+1, len(text)):
        c = text[i]
        if escaped:
            escaped = False
            continue
        if c == '\\':
            escaped = True
            continue
        if c == quote_char:
            return i
    return -1


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


def extract_sql_and_args(text):
    mismatches = []
    # Match db.prepare(`...`) or db.prepare("...") or db.prepare('...')
    for m in re.finditer(r'db\.prepare\s*\(\s*([`"\'])([\s\S]*?)\1\s*\)\s*\.\s*(run|all|get)\s*\(', text):
        quote = m.group(1)
        sql = m.group(2)
        method = m.group(3)
        # find the full arg list starting at the open paren after .run/.all/.get
        open_paren_index = m.end() - 1
        close_paren_index = find_matching_paren(text, open_paren_index)
        if close_paren_index == -1:
            continue
        args_text = text[open_paren_index+1:close_paren_index]
        args = split_js_args(args_text)
        placeholders = sql.count('?')
        arg_count = len([a for a in args if a.strip() != ''])
        if placeholders != arg_count:
            mismatches.append((sql, method, placeholders, arg_count, args))
    return mismatches

for path in Path('main').rglob('*.js'):
    text = path.read_text(encoding='utf-8')
    mismatches = extract_sql_and_args(text)
    for sql, method, placeholders, arg_count, args in mismatches:
        print(path, 'method', method, 'placeholders', placeholders, 'args', arg_count)
        print('SQL:', sql)
        print('ARGS:', args)
        print('---')
print('done')
