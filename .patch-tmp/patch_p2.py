# -*- coding: utf-8 -*-
# Patch P2: turunkan Cache-Control di /api/maintenance-status dari 30/10 ke 5 detik.
# Idempotent: kalau sudah 5, skip.

import io, sys, os

PATH = "src/app/api/maintenance-status/route.ts"

if not os.path.exists(PATH):
    print("ERROR: file tidak ditemukan: %s" % PATH)
    sys.exit(1)

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

changed = 0

# Lokasi 1: response sukses
old1 = "'Cache-Control': 'public, max-age=30, s-maxage=30'"
new1 = "'Cache-Control': 'public, max-age=5, s-maxage=5'"
if new1 in content:
    print("SKIP P2.1: Cache-Control sukses sudah 5 detik.")
else:
    if content.count(old1) != 1:
        print("ERROR P2.1: marker max-age=30 tidak unik. count=%d" % content.count(old1))
        sys.exit(1)
    content = content.replace(old1, new1, 1)
    changed += 1
    print("OK P2.1: Cache-Control sukses 30 -> 5.")

# Lokasi 2: response catch (fallback)
old2 = "'Cache-Control': 'public, max-age=10, s-maxage=10'"
new2 = "'Cache-Control': 'public, max-age=5, s-maxage=5'"
if new2 in content:
    print("SKIP P2.2: Cache-Control fallback sudah 5 detik.")
else:
    if content.count(old2) != 1:
        print("ERROR P2.2: marker max-age=10 tidak unik. count=%d" % content.count(old2))
        sys.exit(1)
    content = content.replace(old2, new2, 1)
    changed += 1
    print("OK P2.2: Cache-Control fallback 10 -> 5.")

if changed == 0:
    print("Tidak ada perubahan (semua sudah 5 detik).")
    sys.exit(0)

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("SELESAI: %d perubahan diterapkan." % changed)
