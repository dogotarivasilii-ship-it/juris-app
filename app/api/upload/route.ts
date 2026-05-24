import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.startsWith('multipart/form-data')) {
      return NextResponse.json({ error: 'Unsupported content-type' }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get('file') as any;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Basic validation
    const maxSize = 10 * 1024 * 1024; // 10 MB
    const size = (file.size as number) || 0;
    if (size > maxSize) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });

    const allowedExt = ['.pdf', '.txt'];
    const origName = file.name || 'upload.bin';
    const ext = origName.includes('.') ? origName.slice(origName.lastIndexOf('.')).toLowerCase() : '';
    if (allowedExt.indexOf(ext) === -1) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to uploads with unique name
    const fs = await import('fs/promises');
    const path = await import('path');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const safeName = origName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const outName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safeName}`;
    const filePath = path.join(uploadsDir, outName);
    await fs.writeFile(filePath, buffer);

    // Extract text (try pdf-parse, fallback to pdfjs)
    let text = '';
    try {
      const tryImport = async (name: string) => { try { return await import(name); } catch { return null; } };
      let mod: any = await tryImport('pdf-parse') ?? await tryImport('pdf-parse/node') ?? await tryImport('pdf-parse/dist/node');
      if (mod) {
        if (typeof mod === 'function') {
          const parsed = await mod(buffer as any);
          text = parsed?.text ?? '';
        } else if (mod.default && typeof mod.default === 'function') {
          const parsed = await mod.default(buffer as any);
          text = parsed?.text ?? '';
        }
      }
      if (!text) {
        const pdfjs = await tryImport('pdfjs-dist/legacy/build/pdf.mjs') ?? await tryImport('pdfjs-dist');
        if (pdfjs) {
          const uint8 = new Uint8Array(buffer);
          const loadingTask = pdfjs.getDocument({ data: uint8 });
          const doc = await loadingTask.promise;
          let out = '';
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map((it: any) => (typeof it.str === 'string' ? it.str : (it.toString && typeof it.toString === 'function' ? it.toString() : '')));
            out += strings.join(' ') + '\n\n';
            if (page.cleanup) try { page.cleanup(); } catch (_) {}
          }
          text = out;
        }
      }
    } catch (e) {
      console.error('Text extraction failed', e);
      text = '';
    }

    // Save metadata to DB (prefer Prisma client, fallback to prisma db execute)
    let dbSaved = false;
    let dbId: number | null = null;
    if (process.env.DATABASE_URL) {
      try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const rec = await prisma.actNormativ.create({ data: { title: origName, content: text } as any });
        dbSaved = true;
        dbId = (rec as any).id ?? null;
        await prisma.$disconnect();
      } catch (e) {
        console.error('Prisma client save failed, trying CLI fallback', e);
        try {
          const fsPromises = await import('fs/promises');
          const path = await import('path');
          const tmpSql = path.join(uploadsDir, `${Date.now()}-insert.sql`);
          const esc = (s: string) => (s || '').replace(/'/g, "''");
          const now = "datetime('now')";
          const sql = `INSERT INTO ActNormativ (title, content, createdAt, updatedAt) VALUES ('${esc(origName)}', '${esc(text)}', ${now}, ${now});`;
          await fsPromises.writeFile(tmpSql, sql, 'utf8');
          const cp = await import('child_process');
          await new Promise((resolve, reject) => {
            cp.exec(`npx prisma db execute --file "${tmpSql}"`, { cwd: process.cwd() }, (error: any, stdout: string, stderr: string) => {
              if (error) return reject(error);
              resolve({ stdout, stderr });
            });
          });
          try { await fsPromises.unlink(tmpSql); } catch (_) {}
          dbSaved = true;
        } catch (dbErr) {
          console.error('DB fallback save failed', dbErr);
        }
      }
    }

    return NextResponse.json({ filename: outName, originalName: origName, text: text.slice(0, 2000), dbSaved, dbId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 });
  }
}
