import json
import ast
import xml.etree.ElementTree as ET
import re
try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False
try:
    import pyflakes.api
    HAS_PYFLAKES = True
except ImportError:
    HAS_PYFLAKES = False

def parse_syntax(content: str, file_type: str):
    """
    Parse the syntax of the given content for the specified file type.
    Returns (valid: bool, errors: list of dict with 'line', 'col', 'msg')
    """
    if file_type.lower() in ['json']:
        return parse_json(content)
    elif file_type.lower() in ['py', 'python']:
        return parse_python(content)
    elif file_type.lower() in ['xml']:
        return parse_xml(content)
    elif file_type.lower() in ['java']:
        return parse_java(content)
    elif file_type.lower() in ['js', 'javascript']:
        return parse_javascript(content)
    elif file_type.lower() in ['yml', 'yaml']:
        return parse_yaml(content)
    else:
        # For unknown types, assume valid (no syntax check)
        return True, []

def parse_json(content: str):
    try:
        json.loads(content)
        return True, []
    except json.JSONDecodeError as e:
        return False, [{"line": e.lineno, "col": e.colno, "msg": str(e)}]

def parse_python(content: str):
    if HAS_PYFLAKES:
        import pyflakes.reporter

        class CapturingReporter(pyflakes.reporter.Reporter):
            def __init__(self):
                self.errors = []

            def unexpectedError(self, filename, msg):
                self.errors.append({"line": 0, "col": 0, "msg": f"unexpected error: {msg}"})

            def syntaxError(self, filename, msg, lineno, offset, text):
                self.errors.append({"line": lineno, "col": offset, "msg": msg})

            def flake(self, message):
                # message is a pyflakes.messages.Message object
                self.errors.append({"line": message.lineno, "col": message.col, "msg": message.message % message.message_args})

        reporter = CapturingReporter()
        try:
            pyflakes.api.check(content, '<string>', reporter)
            if reporter.errors:
                return False, reporter.errors
            else:
                return True, []
        except Exception as e:
            return False, [{"line": 0, "col": 0, "msg": str(e)}]
    else:
        # Fallback to ast.parse
        try:
            ast.parse(content)
            return True, []
        except SyntaxError as e:
            return False, [{"line": e.lineno or 0, "col": e.offset or 0, "msg": e.msg}]
        except Exception as e:
            return False, [{"line": 0, "col": 0, "msg": str(e)}]

def parse_xml(content: str):
    try:
        ET.fromstring(content)
        return True, []
    except ET.ParseError as e:
        # Extract line and col if possible
        msg = str(e)
        # ET.ParseError may have line info in msg, but not standardized
        # For simplicity, set line=0, col=0
        return False, [{"line": 0, "col": 0, "msg": msg}]
    except Exception as e:
        return False, [{"line": 0, "col": 0, "msg": str(e)}]

def parse_java(content: str):
    # Basic Java syntax check using regex and simple rules
    # This is not a full parser, just basic checks
    errors = []
    lines = content.splitlines()
    for i, line in enumerate(lines, 1):
        line = line.strip()
        if line.startswith('//') or line.startswith('/*') or '*/' in line:
            continue  # comments
        # Check for unbalanced braces, but simple
        if '{' in line and '}' not in line and not line.endswith('{'):
            pass  # not checking
        # Check for missing semicolon in statements
        if re.search(r'\b(class|interface|public|private|protected|void|int|String|if|for|while)\b', line) and not line.endswith(';') and not '{' in line:
            if not line.endswith('{') and not line.endswith('}') and not line.endswith('*/'):
                errors.append({"line": i, "col": len(line), "msg": "Possible missing semicolon or brace"})
    # If no obvious errors, assume valid
    if not errors:
        return True, []
    else:
        return False, errors

def parse_javascript(content: str):
    # Simple JS syntax check, similar to Java
    errors = []
    lines = content.splitlines()
    for i, line in enumerate(lines, 1):
        line = line.strip()
        if line.startswith('//') or line.startswith('/*') or '*/' in line:
            continue
        # Check for missing semicolon in statements
        if re.search(r'\b(var|let|const|function|if|for|while|return)\b', line) and not line.endswith(';') and not '{' in line and not line.endswith('}'):
            if not line.endswith('*/') and not line.endswith('*/'):
                errors.append({"line": i, "col": len(line), "msg": "Possible missing semicolon"})
    if not errors:
        return True, []
    else:
        return False, errors

def parse_yaml(content: str):
    if not HAS_YAML:
        return True, []  # Assume valid if no yaml lib
    try:
        yaml.safe_load(content)
        return True, []
    except yaml.YAMLError as e:
        # Extract line if possible
        msg = str(e)
        # YAML errors have line info in context
        line = 0
        if hasattr(e, 'problem_mark') and e.problem_mark:
            line = e.problem_mark.line + 1
            col = e.problem_mark.column + 1
        else:
            col = 0
        return False, [{"line": line, "col": col, "msg": msg}]
    except Exception as e:
        return False, [{"line": 0, "col": 0, "msg": str(e)}]