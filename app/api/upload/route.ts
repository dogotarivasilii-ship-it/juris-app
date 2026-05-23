import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.startsWith('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file') as any;
      if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const parsed = await pdf(buffer as any);
      const text = parsed.text;

      // store in DB
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.actNormativ.create({ data: { title: file.name, content: text } });

      return NextResponse.json({ filename: file.name, text: text.slice(0, 1000) });
    }

    return NextResponse.json({ error: 'Unsupported content-type' }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to parse' }, { status: 500 });
  }
}
