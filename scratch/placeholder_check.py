from pathlib import Path
import re
text = Path('main/main_db.js').read_text(encoding='utf-8')
start = text.index('function addTask(task)')
end = text.index('function fetchTasks', start)
func = text[start:end]
print(func)
sql_block = re.search(r'db\.prepare\(`([\s\S]*?)`\)\.run\(', func)
print('sql_block', bool(sql_block))
print('SQL placeholders', sql_block.group(1).count('?') if sql_block else None)
args_block = re.search(r'\.run\(([^)]*)\)', func)
print('args count', len([a.strip() for a in args_block.group(1).split(',') if a.strip()]) if args_block else None)
print('args', [a.strip() for a in args_block.group(1).split(',') if a.strip()] if args_block else None)
