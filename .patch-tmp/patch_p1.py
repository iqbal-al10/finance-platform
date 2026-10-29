# -*- coding: utf-8 -*-
# Patch P1: turunkan CACHE_TTL_MS di settings.ts dari 30 detik ke 5 detik
# Idempotent: kalau sudah 5 detik, skip.

import io, sys, os

PATH = "src/lib/settings.ts"

if not os.path.exists(PATH):
    print("ERROR: file tidak ditemukan: %s" % PATH)
    sys.exit(1)

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

if "const CACHE_TTL_MS = 5 * 1000" in content:
    print("SKIP P1: CACHE_TTL_MS sudah 5 detik.")
    sys.exit(0)

old = "const CACHE_TTL_MS = 30 * 1000 // 30 detik"
new = "const CACHE_TTL_MS = 5 * 1000 // 5 detik"

if content.count(old) != 1:
    print("ERROR P1: marker 'CACHE_TTL_MS = 30 * 1000' tidak unik. count=%d" % content.count(old))
    sys.exit(1)

content = content.replace(old, new, 1)

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("OK P1: CACHE_TTL_MS diturunkan ke 5 detik.")
