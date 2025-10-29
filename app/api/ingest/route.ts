import { NextResponse } from 'next/server';
import { addYoutubeContent } from '@/app/actions/ingest';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = String(body?.url ?? '').trim();
    if (!url) return NextResponse.json({ message: 'Missing url', error: true }, { status: 400 });

    // Build a FormData instance to reuse the server action signature
    const fd = new FormData();
    fd.append('url', url);

    const result = await addYoutubeContent(fd as unknown as FormData);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API ingest] error', err);
    return NextResponse.json({ message: err?.message ?? 'Internal error', error: true }, { status: 500 });
  }
}
