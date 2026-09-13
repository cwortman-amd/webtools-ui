#!/usr/bin/env python3
"""
CSS Deduplication Tool (Phase 9.8c)
Usage: ./prune_css.py <target_css_file> [base_css_file]

This tool parses a target CSS file and compares its top-level selectors 
against a canonical baseline CSS file (defaults to ../css/base.css).
Any selector in the target file that exactly matches a selector in the
baseline file (and is not a media query) is completely pruned from the 
target file. This enforces CSS harmonization across consumer dashboards 
by forcing them to inherit the canonical definitions.
"""

import re
import sys
import os

import argparse

def extract_selectors(css_text):
    """
    Rudimentary CSS parser to extract top-level selectors and their bodies.
    Returns a list of tuples: (selector_string, start_index, end_index, body_string)
    """
    blocks = []
    brace_level = 0
    in_comment = False
    i = 0
    sel_start = 0
    while i < len(css_text):
        if css_text[i:i+2] == '/*':
            in_comment = True
            i += 2
            continue
        if in_comment:
            if css_text[i:i+2] == '*/':
                in_comment = False
                i += 2
                sel_start = i
            else:
                i += 1
            continue
            
        char = css_text[i]
        if char == '{':
            if brace_level == 0:
                sel = css_text[sel_start:i].strip()
                # Normalize selector whitespace for matching
                sel = re.sub(r'\s+', ' ', sel)
                block_start = i
            brace_level += 1
        elif char == '}':
            brace_level -= 1
            if brace_level == 0:
                block_end = i + 1
                body = css_text[block_start:block_end]
                blocks.append((sel, sel_start, block_end, body))
                sel_start = block_end
        i += 1
    return blocks

def main():
    parser = argparse.ArgumentParser(description="Prune duplicated CSS blocks against a baseline.")
    parser.add_argument("target", help="Target CSS file to prune")
    parser.add_argument("base", nargs="?", help="Base CSS file to compare against (defaults to ../css/base.css)")
    parser.add_argument("-y", "--yes", action="store_true", help="Automatically apply changes without prompting")
    args = parser.parse_args()

    target_file = args.target
    
    # Default to webtools-ui/css/base.css relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_base = os.path.join(script_dir, '..', 'css', 'base.css')
    base_file = args.base if args.base else default_base

    if not os.path.exists(base_file):
        print(f"Error: Base CSS file not found at {base_file}")
        sys.exit(1)
        
    if not os.path.exists(target_file):
        print(f"Error: Target CSS file not found at {target_file}")
        sys.exit(1)

    print(f"Loading canonical baseline: {base_file}")
    with open(base_file, 'r') as f:
        base_css = f.read()

    base_blocks = extract_selectors(base_css)
    base_sels = set()
    for sel, start, end, body in base_blocks:
        if not sel.startswith('@media'):
            # Split comma-separated selectors to catch individual targets
            for sub_sel in sel.split(','):
                sub_sel = sub_sel.strip()
                if sub_sel:
                    base_sels.add(sub_sel)

    print(f"Processing target file: {target_file}")
    with open(target_file, 'r') as f:
        target_css = f.read()
        
    target_blocks = extract_selectors(target_css)
    to_remove = []
    
    for sel, start, end, body in target_blocks:
        if sel.startswith('@media'): 
            continue
        
        # Check if ALL comma-separated parts of the target selector exist in base.css
        sub_sels = [s.strip() for s in sel.split(',') if s.strip()]
        if len(sub_sels) > 0 and all(s in base_sels for s in sub_sels):
            print(f"  [✂️] Pruning duplicated selector: {sel}")
            to_remove.append((start, end))
            
    if not to_remove:
        print("  ✓ No duplicated blocks found. Target is clean.")
        sys.exit(0)

    print(f"\nFound {len(to_remove)} duplicated blocks to prune.")
    if not args.yes:
        # Check if stdin is interactive
        if sys.stdin.isatty():
            choice = input(f"Apply these CSS prunes to {target_file}? [y/N]: ").strip().lower()
            if choice != 'y':
                print("Aborted.")
                sys.exit(0)
        else:
            print("Run with -y to apply changes automatically when not in an interactive terminal.")
            sys.exit(1)

    # Remove blocks in reverse order so indices remain valid
    new_css = target_css
    for start, end in sorted(to_remove, reverse=True):
        new_css = new_css[:start] + new_css[end:]
        
    with open(target_file, 'w') as f:
        f.write(new_css)
        
    print(f"\nSuccessfully pruned {len(to_remove)} blocks from {target_file}")

if __name__ == '__main__':
    main()
