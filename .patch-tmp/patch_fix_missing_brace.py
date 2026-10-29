# -*- coding: utf-8 -*-
# Fix: tambah '}' penutup proxy() yang hilang.
# Idempotent: kalau sudah ada '}' setelah return NextResponse.next(),
# skip (tidak menambah dobel).

import io, sys, os

PATH = "src/proxy.ts"

if not os.path.exists(PATH):
    print("ERROR: file tidak ditemukan: %s" % PATH)
    sys.exit(1)

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Marker: blok akhir proxy() yang kehilangan '}'
# Cari pola: "  return NextResponse.next()\n\n// ====...MATCHER"
# (tanpa '}' di antaranya)
old = (
    "  return NextResponse.next()\n"
    "\n"
    "// ============================================\n"
    "// MATCHER\n"
    "// ============================================\n"
)

new = (
    "  return NextResponse.next()\n"
    "}\n"
    "\n"
    "// ============================================\n"
    "// MATCHER\n"
    "// ============================================\n"
)

# Idempotent: kalau pola new sudah ada, skip
if new in content:
    print("SKIP: '}' penutup proxy() sudah ada.")
    sys.exit(0)

c = content.count(old)
if c != 1:
    print("ERROR: marker tidak unik / tidak ditemukan. count=%d" % c)
    sys.exit(1)

content = content.replace(old, new, 1)

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("OK: '}' penutup proxy() ditambahkan.")
