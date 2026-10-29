# -*- coding: utf-8 -*-
# Patch P3b: tambah '/admin' ke MAINTENANCE_EXEMPT_PAGE_PREFIXES di proxy.ts
# Idempotent: cek marker SPESIFIK per-lokasi.

import io, sys, os

PATH = "src/proxy.ts"

if not os.path.exists(PATH):
    print("ERROR: file tidak ditemukan: %s" % PATH)
    sys.exit(1)

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Cek idempotent: apakah '/admin' sudah ada di MAINTENANCE_EXEMPT_PAGE_PREFIXES?
# Kita cek blok array-nya spesifik, bukan global.
old_block = (
    "const MAINTENANCE_EXEMPT_PAGE_PREFIXES = [\n"
    "  '/auth',\n"
    "  '/maintenance',\n"
    "]"
)
new_block = (
    "const MAINTENANCE_EXEMPT_PAGE_PREFIXES = [\n"
    "  '/auth',\n"
    "  '/maintenance',\n"
    "  '/admin',\n"
    "]"
)

if new_block in content:
    print("SKIP P3b: '/admin' sudah ada di MAINTENANCE_EXEMPT_PAGE_PREFIXES.")
    sys.exit(0)

c = content.count(old_block)
if c != 1:
    print("ERROR P3b: marker MAINTENANCE_EXEMPT_PAGE_PREFIXES tidak unik. count=%d" % c)
    sys.exit(1)

content = content.replace(old_block, new_block, 1)

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("OK P3b: '/admin' ditambahkan ke MAINTENANCE_EXEMPT_PAGE_PREFIXES.")
