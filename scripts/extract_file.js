const fs = require('fs');
(async ()=>{
  try{
    const filepath = process.argv[2];
    if (!filepath) { console.error('NO_FILE'); process.exit(2); }
    if (!fs.existsSync(filepath)) { console.error('NO_EXIST'); process.exit(3); }
    const buffer = fs.readFileSync(filepath);
    let text='';
    try{
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      text = data.text || '';
      console.log(JSON.stringify({text}));
      process.exit(0);
    }catch(e){
      // try pdfjs
      try{
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const uint8 = new Uint8Array(buffer);
        const loadingTask = pdfjs.getDocument({ data: uint8 });
        const doc = await loadingTask.promise;
        let out='';
        for(let i=1;i<=doc.numPages;i++){
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map(it => (typeof it.str==='string'?it.str:(it.toString && typeof it.toString==='function'?it.toString():'')));
          out += strings.join(' ') + '\n\n';
          if(page.cleanup) try { page.cleanup(); } catch(_) {}
        }
        text = out;
        console.log(JSON.stringify({text}));
        process.exit(0);
      }catch(e2){
        console.error('EXTRACT_FAILED', String(e2));
        console.log(JSON.stringify({text:''}));
        process.exit(0);
      }
    }
  }catch(err){ console.error('ERR',err); console.log(JSON.stringify({text:''})); process.exit(1); }
})();
