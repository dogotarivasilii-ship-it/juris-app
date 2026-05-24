const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

jest.setTimeout(30000);

describe('POST /api/upload with PDF', () => {
  test('uploads a PDF and returns non-empty extracted text', async () => {
    const filePath = 'uploads/152512.pdf';
    if (!fs.existsSync(filePath)) throw new Error('Test PDF not found: ' + filePath);

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const res = await axios.post('http://localhost:3000/api/upload', form, { headers: form.getHeaders(), timeout: 20000 });

    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('originalName');
    expect(typeof res.data.text).toBe('string');
    // Expect some extracted text (heuristic)
    expect(res.data.text.length).toBeGreaterThan(10);
  });
});
