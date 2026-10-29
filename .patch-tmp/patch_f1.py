# -*- coding: utf-8 -*-
# Patch F1: jangan redirect /auth/* ke /dashboard saat maintenance aktif.
# Idempotent: cek marker SPESIFIK per-lokasi.

import io, sys, os

PATH = "src/proxy.ts"

if not os.path.exists(PATH):
    print("ERROR: file tidak ditemukan: %s" % PATH)
    sys.exit(1)

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

old = (
    "  if (token && isPublicPath) {\n"
    "    return NextResponse.redirect(new URL('/dashboard', request.url))\n"
    "  }\n"
)

new = (
    "  // Jika user sudah login & buka halaman publik (login/register/dll):\n"
    "  // - Kalau maintenance AKTIF: JANGAN redirect ke /dashboard (akan\n"
    "  //   balik ke /maintenance -> loop). Biarkan user di halaman publik.\n"
    "  // - Kalau maintenance NONAKTIF: redirect ke /dashboard (perilaku lama).\n"
    "  if (token && isPublicPath && !status.maintenance) {\n"
    "    return NextResponse.redirect(new URL('/dashboard', request.url))\n"
    "  }\n"
)

# Idempotent
if "if (token && isPublicPath && !status.maintenance)" in content:
    print("SKIP F1: kondisi sudah ada.")
    sys.exit(0)

c = content.count(old)
if c != 1:
    print("ERROR F1: marker tidak unik. count=%d" % c)
    sys.exit(1)

content = content.replace(old, new, 1)

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("OK F1: kondisi !status.maintenance ditambahkan ke blok token && isPublicPath.")
