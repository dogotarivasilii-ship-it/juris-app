'use client';

import { useState } from 'react';

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json();
    setResult(json.text || 'No text');
  };

  return (
    <form onSubmit={onSubmit}>
      <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button type="submit">Upload</button>
      {result && <pre style={{ whiteSpace: 'pre-wrap' }}>{result}</pre>}
    </form>
  );
}
