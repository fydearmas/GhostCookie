"""Collect upstream license notices for the runtimes used by the assistant."""

import argparse
from importlib import metadata
from pathlib import Path
import sys

from packaging.requirements import Requirement
from packaging.utils import canonicalize_name


LICENSES = Path(__file__).resolve().with_name("licenses")
LICENSE_NAMES = ("license", "licence", "copying", "copyright", "notice")


def license_section(name, texts):
    heading = f"{name}\n{'=' * len(name)}"
    return f"\n\n{heading}\n\n" + "\n\n".join(text.strip() for text in texts)


def dependency_distributions():
    pending = ["keyring", "pyinstaller"]
    distributions = {}
    while pending:
        name = canonicalize_name(pending.pop())
        if name in distributions:
            continue
        distribution = metadata.distribution(name)
        distributions[name] = distribution
        for entry in distribution.requires or ():
            requirement = Requirement(entry)
            if requirement.marker is None or requirement.marker.evaluate({"extra": ""}):
                pending.append(requirement.name)
    return distributions


def distribution_license_texts(distribution):
    texts = []
    for file in sorted(distribution.files or ()):
        if not any(part.endswith(".dist-info") for part in file.parts):
            continue
        if file.name.casefold().startswith(LICENSE_NAMES):
            content = distribution.locate_file(file).read_text(encoding="utf-8-sig")
            if content not in texts:
                texts.append(content)
    if not texts:
        name = distribution.metadata["Name"]
        raise ValueError(f"Missing wheel license text for {name} {distribution.version}")
    return texts


def cpython_notice():
    shipped_notice = Path(sys.base_prefix) / "LICENSE.txt"
    if shipped_notice.is_file():
        return shipped_notice
    if sys.version_info[:2] == (3, 12):
        return LICENSES / "cpython-3.12.txt"
    raise ValueError("Missing license text for this CPython runtime. Use the supported CPython 3.12 build.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--inno", action="store_true")
    options = parser.parse_args()
    notices = [
        "Ghost Cookie Assistant — Third-party notices",
        license_section("CPython", [cpython_notice().read_text(encoding="utf-8-sig")]),
        license_section("Tcl 8.6", [(LICENSES / "tcl-8.6.txt").read_text(encoding="utf-8")]),
        license_section("Tk 8.6", [(LICENSES / "tk-8.6.txt").read_text(encoding="utf-8")]),
        license_section("OpenSSL 3", [(LICENSES / "openssl-3.txt").read_text(encoding="utf-8")]),
        license_section("libffi 3", [(LICENSES / "libffi-3.txt").read_text(encoding="utf-8")]),
    ]
    if options.inno:
        notices.append(license_section("Inno Setup", [(LICENSES / "inno-setup.txt").read_text(encoding="utf-8")]))
    for _, distribution in sorted(dependency_distributions().items()):
        name = f"{distribution.metadata['Name']} {distribution.version}"
        notices.append(license_section(name, distribution_license_texts(distribution)))
    options.output.write_text("".join(notices) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
