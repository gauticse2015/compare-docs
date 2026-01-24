import os
import json
import zipfile
import xml.etree.ElementTree as ET
from itertools import zip_longest

def get_structured_diff(input1, input2, input_mode='path', file_type=None):
    """
    API to get structured diff.
    - input_mode: 'path' (default, file paths) or 'content' (string contents)
    - file_type: optional, e.g., 'json', 'docx', 'text' (auto-detect if path)
    Returns: dict with 'identical', 'diffs' list of {'location': str, 'level': str, 'desc': str}, 'warnings': list
    """
    diffs = []
    warnings = []
    try:
        if input_mode == 'path':
            ext = os.path.splitext(input1)[1].lower()
            if not file_type:
                file_type = ext[1:] if ext else 'text'  # e.g., 'json', 'docx'
            if ext != os.path.splitext(input2)[1].lower():
                warnings.append("Files have different extensions")
            
            # Load data
            if file_type == 'docx':
                lines1 = extract_docx_text(input1) or open_file_lines(input1)
                lines2 = extract_docx_text(input2) or open_file_lines(input2)
            elif file_type == 'json':
                try:
                    with open(input1, 'r') as f:
                        j1 = json.load(f)
                    with open(input2, 'r') as f:
                        j2 = json.load(f)
                    if j1 == j2:
                        return {'identical': True, 'diffs': [], 'warnings': warnings}
                    else:
                        json_diffs = json_diff(j1, j2)
                        for path, level, desc in json_diffs:
                            diffs.append({'location': path, 'level': level, 'desc': desc})
                        return {'identical': False, 'diffs': diffs, 'warnings': warnings}
                except:
                    pass  # fallback
                lines1 = open_file_lines(input1)
                lines2 = open_file_lines(input2)
            else:  # text etc.
                lines1 = open_file_lines(input1)
                lines2 = open_file_lines(input2)
        else:  # content mode, assume text or try json
            if file_type == 'json':
                try:
                    j1 = json.loads(input1)
                    j2 = json.loads(input2)
                    if j1 == j2:
                        return {'identical': True, 'diffs': [], 'warnings': warnings}
                    else:
                        json_diffs = json_diff(j1, j2)
                        for path, level, desc in json_diffs:
                            diffs.append({'location': path, 'level': level, 'desc': desc})
                        return {'identical': False, 'diffs': diffs, 'warnings': warnings}
                except:
                    pass
            # fallback to line-based (split content)
            lines1 = input1.splitlines(True)
            lines2 = input2.splitlines(True)
            file_type = 'text'
        
        # Line-based compare
        if lines1 == lines2:
            return {'identical': True, 'diffs': [], 'warnings': warnings}
        
        for lineno, (l1, l2) in enumerate(zip_longest(lines1 or [], lines2 or []), 1):
            if l1 is None:
                diffs.append({'location': f'Line {lineno}', 'level': 'CRITICAL', 'desc': f'Extra content in file2: {l2.strip() if l2 else ""}'})
                continue
            if l2 is None:
                diffs.append({'location': f'Line {lineno}', 'level': 'CRITICAL', 'desc': f'Extra content in file1: {l1.strip() if l1 else ""}'})
                continue
            l1_str = l1.rstrip('\n')
            l2_str = l2.rstrip('\n')
            if l1_str == l2_str:
                continue
            # Classify
            indent1 = len(l1_str) - len(l1_str.lstrip()) if l1_str else 0
            indent2 = len(l2_str) - len(l2_str.lstrip()) if l2_str else 0
            strip1 = l1_str.strip()
            strip2 = l2_str.strip()
            if strip1 == strip2:
                if indent1 != indent2:
                    level = "ERROR"
                    desc = f"indentation difference: {indent1} vs {indent2} spaces"
                else:
                    level = "WARNING"
                    desc = f"whitespace/spaces difference: '{l1_str}' vs '{l2_str}'"
            else:
                level = "CRITICAL"
                desc = f"content difference: '{l1_str.strip()}' vs '{l2_str.strip()}'"
            diffs.append({'location': f'Line {lineno}', 'level': level, 'desc': desc})
        
        return {'identical': False, 'diffs': diffs, 'warnings': warnings}
    except Exception as e:
        return {'identical': False, 'diffs': [], 'warnings': [str(e)], 'error': str(e)}

def open_file_lines(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.readlines()
    except:
        return []

def extract_docx_text(path):
    try:
        with zipfile.ZipFile(path) as z:
            with z.open('word/document.xml') as f:
                tree = ET.parse(f)
                text = []
                for elem in tree.iter():
                    if elem.text and elem.text.strip():
                        text.append(elem.text + '\n')
                return text
    except:
        return None

def json_diff(d1, d2, path=""):
    diffs = []
    if type(d1) != type(d2):
        diffs.append((path or "root", "CRITICAL", f"type mismatch: {type(d1)} vs {type(d2)}"))
        return diffs
    if isinstance(d1, dict):
        all_keys = set(d1.keys()) | set(d2.keys())
        for k in all_keys:
            new_path = f"{path}/{k}" if path else k
            if k not in d1:
                diffs.append((new_path, "CRITICAL", "missing in file1"))
            elif k not in d2:
                diffs.append((new_path, "CRITICAL", "missing in file2"))
            else:
                diffs.extend(json_diff(d1[k], d2[k], new_path))
    elif isinstance(d1, list):
        max_len = max(len(d1), len(d2))
        for i in range(max_len):
            new_path = f"{path}[{i}]" if path else f"[{i}]"
            if i >= len(d1):
                diffs.append((new_path, "CRITICAL", "missing in file1"))
            elif i >= len(d2):
                diffs.append((new_path, "CRITICAL", "missing in file2"))
            else:
                diffs.extend(json_diff(d1[i], d2[i], new_path))
    elif d1 != d2:
        diffs.append((path or "root", "CRITICAL", f"value mismatch: {d1} vs {d2}"))
    return diffs

def compare_files(file1, file2):
    result = get_structured_diff(file1, file2, input_mode='path')
    if result.get('warnings'):
        for w in result['warnings']:
            print(f"Warning: {w}")
    if result['identical']:
        print("Both files are identical")
        return
    if 'error' in result:
        print(f"Error: {result['error']}")
        return
    # Print based on type (but since API handles)
    if any('missing' in d.get('desc', '') for d in result['diffs']):  # rough json check
        print("JSON structure differences found (nesting/content):")
    else:
        print("Differences found with levels:")
    for d in result['diffs']:
        print(f"{d['location']}: {d['level']} - {d['desc']}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("Usage: python -m src.compare_docs.core <file1> <file2>")
        sys.exit(1)
    compare_files(sys.argv[1], sys.argv[2])