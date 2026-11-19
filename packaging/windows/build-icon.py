"""Package the existing Ghost Cookie PNG artwork into a Windows ICO."""

from pathlib import Path
import struct
import sys


def main():
    sources = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    sizes = (16, 32, 48, 128)
    header = struct.pack("<HHH", 0, 1, len(sizes))
    entries = bytearray()
    payload = bytearray()
    offset = len(header) + (len(sizes) * 16)
    for size in sizes:
        image = (sources / f"icon{size}.png").read_bytes()
        if image[:8] != b"\x89PNG\r\n\x1a\n" or struct.unpack(">II", image[16:24]) != (size, size):
            raise ValueError(f"Expected a {size}×{size} PNG")
        entries.extend(struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(image), offset))
        payload.extend(image)
        offset += len(image)
    destination.write_bytes(header + entries + payload)


if __name__ == "__main__":
    main()
