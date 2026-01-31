#!/usr/bin/env python3

import requests
import json

# Test the syntax parser

base_url = "http://localhost:8000"

# Test JSON
print("Testing JSON validation:")
valid_json = '{"key": "value"}'
invalid_json = '{"key": "value"'

resp = requests.post(f"{base_url}/validate", json={"content": valid_json, "file_type": "json"})
print(f"Valid JSON: {resp.json()}")

resp = requests.post(f"{base_url}/validate", json={"content": invalid_json, "file_type": "json"})
print(f"Invalid JSON: {resp.json()}")

# Test Python
print("\nTesting Python validation:")
valid_py = "print('hello')"
invalid_py = "print('hello'"

resp = requests.post(f"{base_url}/validate", json={"content": valid_py, "file_type": "python"})
print(f"Valid Python: {resp.json()}")

resp = requests.post(f"{base_url}/validate", json={"content": invalid_py, "file_type": "python"})
print(f"Invalid Python: {resp.json()}")

# Test compare with validation
print("\nTesting compare with syntax validation:")
resp = requests.post(f"{base_url}/compare", json={
    "input1": '{"a": 1}',
    "input2": '{"a": 2}',
    "file_type": "json",
    "validate_syntax": True
})
print(f"Compare valid JSON: {resp.json()}")

resp = requests.post(f"{base_url}/compare", json={
    "input1": '{"a": 1',
    "input2": '{"a": 2}',
    "file_type": "json",
    "validate_syntax": True
})
print(f"Compare invalid JSON: {resp.json()}")