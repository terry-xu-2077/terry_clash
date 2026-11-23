"""Apply the minimal headless-router adaptation to a pinned OpenRad checkout."""

import argparse
from pathlib import Path

UPSTREAM_COMMIT = "c7111577ffdfb4ab48ef4ba108ddbcf3ca07795c"


def replace_once(path: Path, before: str, after: str) -> None:
    text = path.read_text(encoding="utf-8")
    if after in text:
        return
    if text.count(before) != 1:
        raise RuntimeError(f"Unexpected upstream source at {path}")
    path.write_text(text.replace(before, after), encoding="utf-8", newline="\n")


def prepare(source: Path) -> None:
    replace_once(
        source / "Cargo.toml",
        '[dependencies]\n',
        '[features]\nrouter-headless = []\n\n[dependencies]\n',
    )
    # The router uses a new, isolated private-file identity profile. No desktop
    # credential store is installed. Existing file identities still prevent init.
    replace_once(
        source / "src/main.rs",
        '                source.is_some()\n            )?,',
        '                source.is_some() || cfg!(feature = "router-headless")\n            )?,',
    )
    print(f"Prepared OpenRad router CLI; upstream {UPSTREAM_COMMIT}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    prepare(parser.parse_args().source)
