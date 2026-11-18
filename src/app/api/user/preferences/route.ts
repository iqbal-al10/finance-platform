import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { z } from 'zod'

const CURRENCIES = ['IDR', 'USD'] as const
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY'] as const
const TIME_FORMATS = ['24', '12'] as const
const TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] as const

const updateSchema = z.object({
  currency: z.enum(CURRENCIES).optional(),
  dateFormat: z.enum(DATE_FORMATS).optional(),
  timeFormat: z.enum(TIME_FORMATS).optional(),
  timezone: z.enum(TIMEZONES).optional(),
  darkMode: z.boolean().optional(),
  toastEnabled: z.boolean().optional(),
  showClock: z.boolean().optional(),
  hasSeenTutorial: z.boolean().optional(),
  hasSeenPosTour: z.boolean().optional(),
  seenTours: z
    .array(z.string().regex(/^[a-z0-9-]{1,40}$/, 'Kunci tour tidak valid'))
    .max(50)
    .transform((arr) => Array.from(new Set(arr)))
    .optional(),
})

const DEFAULTS = {
  currency: 'IDR' as const,
  dateFormat: 'DD/MM/YYYY' as const,
  timeFormat: '24' as const,
  timezone: 'Asia/Jakarta' as const,
  darkMode: false,
  toastEnabled: true,
  showClock: true,
  hasSeenTutorial: false,
  hasSeenPosTour: false,
  seenTours: [] as string[],
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pref = await prisma.userPreference.findUnique({
      where: { userId: session.user.id },
    })

    if (!pref) {
      return NextResponse.json(DEFAULTS)
    }

    return NextResponse.json({
      currency: pref.currency,
      dateFormat: pref.dateFormat,
      timeFormat: pref.timeFormat,
      timezone: pref.timezone,
      darkMode: pref.darkMode,
      toastEnabled: pref.toastEnabled,
      showClock: pref.showClock,
      hasSeenTutorial: pref.hasSeenTutorial,
      hasSeenPosTour: pref.hasSeenPosTour,
      seenTours: pref.seenTours,
    })
  } catch (error: any) {
    console.error('❌ [user/preferences GET] FULL ERROR:', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch (parseErr) {
      console.error('❌ [PUT] JSON parse error:', parseErr)
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validated = updateSchema.parse(body)

    if (Object.keys(validated).length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada preferensi yang dikirim' },
        { status: 400 }
      )
    }

    const pref = await prisma.userPreference.upsert({
      where: { userId: session.user.id },
      update: validated,
      create: {
        userId: session.user.id,
        ...validated,
      },
    })

    return NextResponse.json({
      currency: pref.currency,
      dateFormat: pref.dateFormat,
      timeFormat: pref.timeFormat,
      timezone: pref.timezone,
      darkMode: pref.darkMode,
      toastEnabled: pref.toastEnabled,
      showClock: pref.showClock,
      hasSeenTutorial: pref.hasSeenTutorial,
      hasSeenPosTour: pref.hasSeenPosTour,
      seenTours: pref.seenTours,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('❌ [user/preferences PUT] FULL ERROR:', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    })

    return NextResponse.json(
      { error: 'Internal Server Error', code: error?.code },
      { status: 500 }
    )
  }
}
