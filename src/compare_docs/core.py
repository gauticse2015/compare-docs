import os
import json
import zipfile
import xml.etree.ElementTree as ET
from itertools import zip_longest
import difflib
from docx import Document

def extract_line_number(location):
    """Extract line number from location string."""
    parts = location.split()
    for part in parts:
        if part.isdigit():
            return int(part)
    return 0

def compare_docx_files(path1, path2):
    """
    Compare two Docx files by extracting text and doing line-based diff for consistency with UI highlighting.
    """
    text1 = extract_docx_text(path1)
    text2 = extract_docx_text(path2)
    diffs = []
    if text1 is None or text2 is None:
        diffs.append({'location': 'File', 'level': 'CRITICAL', 'desc': 'Failed to extract text from Docx file'})
        return diffs

    lines1 = text1 if isinstance(text1, list) else text1.splitlines(True)
    lines2 = text2 if isinstance(text2, list) else text2.splitlines(True)

    # Line-based compare
    matcher = difflib.SequenceMatcher(None, lines1, lines2)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            continue
        elif tag == 'delete':
            for idx in range(i1, i2):
                lineno = idx + 1
                diffs.append({'location': f'Left Line {lineno}', 'level': 'CRITICAL', 'desc': f'Extra content in file1: {lines1[idx].strip()}'})
        elif tag == 'insert':
            for idx in range(j1, j2):
                lineno = idx + 1
                diffs.append({'location': f'Right Line {lineno}', 'level': 'CRITICAL', 'desc': f'Extra content in file2: {lines2[idx].strip()}'})
        elif tag == 'replace':
            len_a = i2 - i1
            len_b = j2 - j1
            max_len = max(len_a, len_b)
            for k in range(max_len):
                l1 = lines1[i1 + k] if k < len_a else None
                l2 = lines2[j1 + k] if k < len_b else None
                if l1 is None:
                    lineno = j1 + k + 1
                    diffs.append({'location': f'Right Line {lineno}', 'level': 'CRITICAL', 'desc': f'Extra content in file2: {l2.strip()}'})
                    continue
                if l2 is None:
                    lineno = i1 + k + 1
                    diffs.append({'location': f'Left Line {lineno}', 'level': 'CRITICAL', 'desc': f'Extra content in file1: {l1.strip()}'})
                    continue
                lineno = i1 + k + 1
                l1_str = l1.rstrip('\n')
                l2_str = l2.rstrip('\n')
                if l1_str == l2_str:
                    continue
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
                    desc = f"content difference: '{l1_str}' vs '{l2_str}'"
                diffs.append({'location': f'Line {lineno}', 'level': level, 'desc': desc})

    return diffs

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
                diffs = compare_docx_files(input1, input2)
                identical = len(diffs) == 0
                return {'identical': identical, 'diffs': diffs, 'warnings': warnings}
            elif file_type == 'json':
                try:
                    with open(input1, 'r') as f:
                        content1 = f.read()
                        j1 = json.loads(content1)
                    with open(input2, 'r') as f:
                        content2 = f.read()
                        j2 = json.loads(content2)
                    if j1 == j2:
                        return {'identical': True, 'diffs': [], 'warnings': warnings}
                    else:
                        json_diffs = json_diff(j1, j2)
                        for path, level, desc, side in json_diffs:
                            if side == 'file1':
                                content = content1
                            elif side == 'file2':
                                content = content2
                            else:
                                content = content1
                            lineno = find_line_for_path(content, path)
                            location = f'Line {lineno}' if lineno else path
                            diffs.append({'location': location, 'level': level, 'desc': desc})
                        # Sort diffs by line number for better ordering
                        diffs.sort(key=lambda d: extract_line_number(d['location']))
                        return {'identical': False, 'diffs': diffs, 'warnings': warnings}
                except:
                    pass  # fallback
                lines1 = open_file_lines(input1)
                lines2 = open_file_lines(input2)
            else:  # text etc.
                lines1 = open_file_lines(input1)
                lines2 = open_file_lines(input2)
        else:  # content mode, assume text or try json
            # Try JSON first, regardless of file_type
            try:
                j1 = json.loads(input1)
                j2 = json.loads(input2)
                if j1 == j2:
                    return {'identical': True, 'diffs': [], 'warnings': warnings}
                else:
                    json_diffs = json_diff(j1, j2)
                    for path, level, desc, side in json_diffs:
                        if side == 'file1':
                            content = input1
                        elif side == 'file2':
                            content = input2
                        else:
                            content = input1
                        lineno = find_line_for_path(content, path)
                        location = f'Line {lineno}' if lineno else path
                        diffs.append({'location': location, 'level': level, 'desc': desc})
                    # Sort diffs by line number for better ordering
                    diffs.sort(key=lambda d: extract_line_number(d['location']))
                    return {'identical': False, 'diffs': diffs, 'warnings': warnings}
            except:
                pass  # not JSON, fallback to text
            # fallback to line-based (split content)
            lines1 = input1.splitlines(True)
            lines2 = input2.splitlines(True)
            file_type = 'text'
        
        # Line-based compare
        if lines1 == lines2:
            return {'identical': True, 'diffs': [], 'warnings': warnings}
        
        matcher = difflib.SequenceMatcher(None, lines1, lines2)
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                continue
            elif tag == 'delete':
                # lines i1 to i2 in lines1 are extra (missing in lines2)
                for idx in range(i1, i2):
                    lineno = idx + 1
                    diffs.append({'location': f'Left Line {lineno}', 'level': 'CRITICAL', 'desc': f'Extra content in file1: {lines1[idx].strip()}'})
            elif tag == 'insert':
                # lines j1 to j2 in lines2 are extra (missing in lines1)
                for idx in range(j1, j2):
                    lineno = idx + 1
                    diffs.append({'location': f'Right Line {lineno}', 'level': 'CRITICAL', 'desc': f'Extra content in file2: {lines2[idx].strip()}'})
            elif tag == 'replace':
                # compare the ranges
                len_a = i2 - i1
                len_b = j2 - j1
                max_len = max(len_a, len_b)
                for k in range(max_len):
                    l1 = lines1[i1 + k] if k < len_a else None
                    l2 = lines2[j1 + k] if k < len_b else None
                    if l1 is None:
                        lineno = j1 + k + 1
                        diffs.append({'location': f'Right Line {lineno}', 'level': 'CRITICAL', 'desc': f'Extra content in file2: {l2.strip()}'})
                        continue
                    if l2 is None:
                        lineno = i1 + k + 1
                        diffs.append({'location': f'Left Line {lineno}', 'level': 'CRITICAL', 'desc': f'Extra content in file1: {l1.strip()}'})
                        continue
                    lineno = i1 + k + 1  # for both
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
                        desc = f"content difference: '{l1_str}' vs '{l2_str}'"
                    diffs.append({'location': f'Line {lineno}', 'level': level, 'desc': desc})
        
        # Sort diffs by line number for better ordering
        diffs.sort(key=lambda d: extract_line_number(d['location']))
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

def find_line_for_path(content, path):
    if not path or path == "root":
        return 1  # first line
    last_key = path.split('/')[-1].split('[')[0]  # remove [index]
    expected_indent = 2 + 2 * path.count('/')
    lines = content.splitlines()
    for i, line in enumerate(lines, 1):
        if f'"{last_key}"' in line and line.startswith(' ' * expected_indent):
            return i
    return None

def json_diff(d1, d2, path=""):
    diffs = []
    if type(d1) != type(d2):
        diffs.append((path or "root", "CRITICAL", f"type mismatch: {type(d1)} vs {type(d2)}", "both"))
        return diffs
    if isinstance(d1, dict):
        all_keys = set(d1.keys()) | set(d2.keys())
        for k in all_keys:
            new_path = f"{path}/{k}" if path else k
            if k not in d1:
                diffs.append((new_path, "CRITICAL", "missing in file1", "file2"))
            elif k not in d2:
                diffs.append((new_path, "CRITICAL", "missing in file2", "file1"))
            else:
                diffs.extend(json_diff(d1[k], d2[k], new_path))
    elif isinstance(d1, list):
        max_len = max(len(d1), len(d2))
        for i in range(max_len):
            new_path = f"{path}[{i}]" if path else f"[{i}]"
            if i >= len(d1):
                diffs.append((new_path, "CRITICAL", "missing in file1", "file2"))
            elif i >= len(d2):
                diffs.append((new_path, "CRITICAL", "missing in file2", "file1"))
            else:
                diffs.extend(json_diff(d1[i], d2[i], new_path))
    elif d1 != d2:
        diffs.append((path or "root", "CRITICAL", f"value mismatch: {d1} vs {d2}", "both"))
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