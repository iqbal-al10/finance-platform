# -*- coding: utf-8 -*-
# Patch P3a: turunkan TTL proxy.ts dari 30 ke 5 detik (2 lokasi).
# Idempotent: cek per-lokasi dengan marker SPESIFIK.

import io, sys, os

PATH = "src/proxy.ts"

if not os.path.exists(PATH):
    print("ERROR: file tidak ditemukan: %s" % PATH)
    sys.exit(1)

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

changed = 0

# Lokasi 1: STATUS_CACHE_TTL_MS
old1 = "const STATUS_CACHE_TTL_MS = 30 * 1000"
new1 = "const STATUS_CACHE_TTL_MS = 5 * 1000"
if old1 not in content:
    if new1 in content:
        print("SKIP P3a.1: STATUS_CACHE_TTL_MS sudah 5 detik.")
    else:
        print("ERROR P3a.1: marker 'STATUS_CACHE_TTL_MS = 30 * 1000' tidak ditemukan.")
        sys.exit(1)
else:
    c = content.count(old1)
    if c != 1:
        print("ERROR P3a.1: marker STATUS_CACHE_TTL_MS tidak unik. count=%d" % c)
        sys.exit(1)
    content = content.replace(old1, new1, 1)
    changed += 1
    print("OK P3a.1: STATUS_CACHE_TTL_MS 30 -> 5.")

# Lokasi 2: next: { revalidate: 30 }
old2 = "next: { revalidate: 30 }"
new2 = "next: { revalidate: 5 }"
if old2 not in content:
    if new2 in content:
        print("SKIP P3a.2: next.revalidate sudah 5 detik.")
    else:
        print("ERROR P3a.2: marker 'next: { revalidate: 30 }' tidak ditemukan.")
        sys.exit(1)
else:
    c = content.count(old2)
    if c != 1:
        print("ERROR P3a.2: marker next.revalidate tidak unik. count=%d" % c)
        sys.exit(1)
    content = content.replace(old2, new2, 1)
    changed += 1
    print("OK P3a.2: next.revalidate 30 -> 5.")

if changed == 0:
    print("Tidak ada perubahan (semua sudah 5 detik).")
    sys.exit(0)

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("SELESAI P3a: %d perubahan diterapkan." % changed)
