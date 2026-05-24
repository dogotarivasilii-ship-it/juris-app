import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.startsWith('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file') as any;
      if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      let text = '';
      try {
        const tryImport = async (name: string) => {
          try { return await import(name); } catch (e) { return null; }
        };
        // Try pdf-parse main / node entrypoints first
        let mod: any = await tryImport('pdf-parse') ?? await tryImport('pdf-parse/node') ?? await tryImport('pdf-parse/dist/node');
        if (mod) {
          // function-style API
          if (typeof mod === 'function') {
            const parsed = await mod(buffer as any);
            text = parsed?.text ?? '';
          } else if (mod.default && typeof mod.default === 'function') {
            const parsed = await mod.default(buffer as any);
            text = parsed?.text ?? '';
          } else if (mod.PDFParse) {
            const Parser = mod.PDFParse;
            const parser = new Parser({ data: buffer });
            const parsed = await parser.getText();
            text = parsed?.text ?? '';
          }
        }
        // Fallback to pdfjs-dist if pdf-parse couldn't produce text
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
      } catch (parseErr) {
        console.error('pdf parse failed', parseErr);
        text = '';
      }

      // store file on disk (dev): save under ./uploads
      const fs = await import('fs/promises');
      const path = await import('path');
      const uploadsDir = path.join(process.cwd(), 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.writeFile(path.join(uploadsDir, file.name), buffer);

      // Extract text using helper script (avoids ESM/bundling issues in route)
      try {
        const cp = await import('child_process');
        const path = await import('path');
        const filePath = path.join(uploadsDir, file.name);
        const execResult = await new Promise((resolve) => {
          cp.execFile('node', ['scripts/extract_file.js', filePath], { cwd: process.cwd() }, (error: any, stdout: string, stderr: string) => {
            resolve({ error, stdout, stderr });
          });
        }) as any;
        try {
          const parsed = JSON.parse(execResult.stdout || '{}');
          text = parsed.text || '';
        } catch(e) {
          console.error('extract script parse failed', execResult.stderr || execResult.stdout || e);
        }
      } catch (ex) {
        console.error('extract script failed', ex);
      }

      // Try to save metadata to database if configured (use prisma CLI as fallback)
      if (process.env.DATABASE_URL) {
        try {
          const fsPromises = await import('fs/promises');
          const path = await import('path');
          const uploadsDir = path.join(process.cwd(), 'uploads');
          const tmpSql = path.join(uploadsDir, `${Date.now()}-insert.sql`);
          // escape single quotes
          const esc = (s: string) => (s || '').replace(/'/g, "''");
          const now = "datetime('now')";
          const sql = `INSERT INTO ActNormativ (title, content, createdAt, updatedAt) VALUES ('${esc(file.name)}', '${esc(text)}', ${now}, ${now});`;
          await fsPromises.writeFile(tmpSql, sql, 'utf8');
          const cp = await import('child_process');
          await new Promise((resolve, reject) => {
            const child = cp.exec(`npx prisma db execute --file "${tmpSql}"`, { cwd: process.cwd() }, (error, stdout, stderr) => {
              if (error) return reject(error);
              resolve({ stdout, stderr });
            });
          });
          // cleanup
          try { await fsPromises.unlink(tmpSql); } catch(_) {}
        } catch (dbErr) {
          console.error('Prisma CLI save failed', dbErr);
        }
      } else {
        console.warn('DATABASE_URL not set; skipping DB save');
      }

      return NextResponse.json({ filename: file.name, text: text.slice(0, 1000) });
    }

    return NextResponse.json({ error: 'Unsupported content-type' }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to parse' }, { status: 500 });
  }
}
