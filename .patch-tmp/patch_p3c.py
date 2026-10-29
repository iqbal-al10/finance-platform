# -*- coding: utf-8 -*-
# Patch P3c: tambah early-return untuk /maintenance di proxy.ts
# Idempotent: cek marker SPESIFIK per-lokasi.

import io, sys, os

PATH = "src/proxy.ts"

if not os.path.exists(PATH):
    print("ERROR: file tidak ditemukan: %s" % PATH)
    sys.exit(1)

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Marker SPESIFIK: blok if (token && isPublicPath) yang lama
old_block = (
    "  if (token && isPublicPath) {\n"
    "    return NextResponse.redirect(new URL('/dashboard', request.url))\n"
    "  }\n"
    "\n"
    "  return NextResponse.next()\n"
)

new_block = (
    "  // /maintenance harus selalu bisa diakses, login atau tidak.\n"
    "  // Jangan redirect ke /dashboard meskipun user punya token,\n"
    "  // karena /dashboard akan di-redirect balik ke /maintenance\n"
    "  // oleh blok maintenance di atas -> infinite redirect loop.\n"
    "  if (path === '/maintenance' || path.startsWith('/maintenance/')) {\n"
    "    return NextResponse.next()\n"
    "  }\n"
    "\n"
    "  if (token && isPublicPath) {\n"
    "    return NextResponse.redirect(new URL('/dashboard', request.url))\n"
    "  }\n"
    "\n"
    "  return NextResponse.next()\n"
)

# Idempotent: kalau early-return sudah ada, skip
if "// /maintenance harus selalu bisa diakses, login atau tidak." in content:
    print("SKIP P3c: early-return /maintenance sudah ada.")
    sys.exit(0)

c = content.count(old_block)
if c != 1:
    print("ERROR P3c: marker 'if (token && isPublicPath)' tidak unik. count=%d" % c)
    sys.exit(1)

content = content.replace(old_block, new_block, 1)

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("OK P3c: early-return /maintenance ditambahkan.")
