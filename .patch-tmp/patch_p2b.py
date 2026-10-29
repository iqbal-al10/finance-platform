# -*- coding: utf-8 -*-
# Patch P2b: perbaiki Cache-Control fallback (max-age=10 -> max-age=5).
# Idempotent: cek marker max-age=10 SPESIFIK (bukan max-age=5).

import io, sys, os

PATH = "src/app/api/maintenance-status/route.ts"

if not os.path.exists(PATH):
    print("ERROR: file tidak ditemukan: %s" % PATH)
    sys.exit(1)

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Marker SPESIFIK untuk fallback lama
old = "'Cache-Control': 'public, max-age=10, s-maxage=10'"
new = "'Cache-Control': 'public, max-age=5, s-maxage=5'"

count_old = content.count(old)
if count_old == 0:
    print("SKIP P2b: marker max-age=10 sudah tidak ada (mungkin sudah 5).")
    sys.exit(0)

if count_old != 1:
    print("ERROR P2b: marker max-age=10 tidak unik. count=%d" % count_old)
    sys.exit(1)

content = content.replace(old, new, 1)

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("OK P2b: Cache-Control fallback 10 -> 5.")
