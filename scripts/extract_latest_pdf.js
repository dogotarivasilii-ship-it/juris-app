const fs = require('fs');
const path = require('path');
(async ()=>{
  try{
    const uploadsDir = path.join(process.cwd(),'uploads');
    const uploads = fs.readdirSync(uploadsDir).filter(f=>f.toLowerCase().endsWith('.pdf')).map(f=>({f, t:fs.statSync(path.join(uploadsDir,f)).mtimeMs})).sort((a,b)=>b.t-a.t);
    if(uploads.length===0){ console.log('NO_PDFS'); process.exit(0); }
    const latest = uploads[0].f;
    console.log('FILE:'+latest);
    let text='';
    // Try pdf-parse
    try{
      console.log('TRY: pdf-parse');
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(fs.readFileSync(path.join(uploadsDir,latest)));
      text = data.text || '';
      console.log('USED: pdf-parse');
    }catch(e){
      console.error('pdf-parse error', String(e).slice(0,200));
      // Try pdfjs
      try{
        console.log('TRY: pdfjs');
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const buffer = fs.readFileSync(path.join(uploadsDir,latest));
        const uint8 = new Uint8Array(buffer);
        const loadingTask = pdfjs.getDocument({ data: uint8 });
        const doc = await loadingTask.promise;
        let out='';
        for(let i=1;i<=doc.numPages;i++){
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map(it => (it.str || (it.toString && it.toString()) || ''));
          out += strings.join(' ') + '\n\n';
          if(page.cleanup) try { page.cleanup(); } catch(_) {}
        }
        text = out;
        console.log('USED: pdfjs');
      }catch(e2){
        console.error('pdfjs error', String(e2).slice(0,200));
      }
    }
    console.log('TEXT_LENGTH:'+ (text?text.length:0));
    console.log('PREVIEW:\n'+ (text?text.slice(0,2000):'<empty>'));
  }catch(err){ console.error('ERR',err); process.exit(1); }
})();
