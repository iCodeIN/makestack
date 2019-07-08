#!/usr/bin/env python3
import argparse
import struct
import sys

"""
struct cred {
    char sha256sum[32];
};
"""

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file")
    parser.add_argument("--endian", default="little")
    parser.add_argument("--version")
    args = parser.parse_args()

    endian = "<" if args.endian == "little" else ">"
    cred = struct.pack(endian + "Q", int(args.version))

    with open(args.file, "rb") as f:
        image = f.read()

    START_HEADER = bytes("__MAKESTACK_CRED_START__", "ascii")
    END_HEADER = bytes("__MAKESTACK_CRED_END__", "ascii")
    header_start = image.find(START_HEADER)
    end = image.find(END_HEADER)
    if header_start < 0 or end < 0:
        sys.exit("failed to locate the cred area")

    start = header_start + len(START_HEADER)
    area_len = end - start
    if len(cred) > area_len:
        sys.exit("the cred area is too short")

    image = image[:start] + cred + image[start + len(cred):]

    with open(args.file, "wb") as f:
        f.write(image)

if __name__ == "__main__":
    main()
