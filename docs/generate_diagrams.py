import re
import os
import subprocess
import sys
import json
import tempfile

DIAGRAMS_MD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Architecture_Diagrams.md")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "diagrams")


def extract_mermaid_blocks(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    headings = re.findall(r"## (Diagram \d+ — .+)", content)
    blocks = re.findall(r"```mermaid\n(.*?)```", content, re.DOTALL)

    diagrams = []
    for i, block in enumerate(blocks):
        title = headings[i] if i < len(headings) else f"Diagram {i + 1}"
        slug = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")
        diagrams.append((title, slug, block.strip()))
    return diagrams


def check_mmdc():
    try:
        result = subprocess.run(
            ["npx", "--yes", "@mermaid-js/mermaid-cli@latest", "--version"],
            capture_output=True, text=True, timeout=120, shell=True,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def render_with_mmdc(mermaid_code, output_path, puppet_config):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".mmd", delete=False, encoding="utf-8") as f:
        f.write(mermaid_code)
        input_file = f.name

    try:
        cmd = [
            "npx", "--yes", "@mermaid-js/mermaid-cli@latest",
            "-i", input_file,
            "-o", output_path,
            "-b", "white",
            "-s", "2",
        ]
        if puppet_config:
            cmd.extend(["-p", puppet_config])

        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=60, shell=True,
        )
        return os.path.exists(output_path)
    except subprocess.TimeoutExpired:
        print("    Timed out", flush=True)
        return False
    finally:
        os.unlink(input_file)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    diagrams = extract_mermaid_blocks(DIAGRAMS_MD)
    print(f"Found {len(diagrams)} diagrams in Architecture_Diagrams.md\n", flush=True)

    print("Checking Mermaid CLI (first run may download dependencies)...", flush=True)
    if not check_mmdc():
        print("Installing @mermaid-js/mermaid-cli...", flush=True)

    puppet_config = None
    puppet_path = os.path.join(OUTPUT_DIR, "puppeteer-config.json")
    config = {"args": ["--no-sandbox", "--disable-setuid-sandbox"]}
    with open(puppet_path, "w") as f:
        json.dump(config, f)
    puppet_config = puppet_path

    success = 0
    failed = []

    for title, slug, code in diagrams:
        print(f"Rendering: {title}...", flush=True)
        output_path = os.path.join(OUTPUT_DIR, f"{slug}.png")
        if render_with_mmdc(code, output_path, puppet_config):
            size_kb = os.path.getsize(output_path) / 1024
            print(f"  Saved [{size_kb:.0f} KB] -> {slug}.png", flush=True)
            success += 1
        else:
            print(f"  FAILED: {title}", flush=True)
            failed.append(title)

    if os.path.exists(puppet_path):
        os.unlink(puppet_path)

    print(f"\nDone! {success}/{len(diagrams)} diagrams saved to docs/diagrams/", flush=True)
    if failed:
        print(f"\nFailed diagrams:", flush=True)
        for f_name in failed:
            print(f"  - {f_name}", flush=True)
        print("\nYou can render these manually at https://mermaid.live", flush=True)


if __name__ == "__main__":
    main()
