const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

jest.setTimeout(20000);

describe('POST /api/upload', () => {
  test('uploads a text file and returns extracted text', async () => {
    const filePath = 'test-upload.txt';
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, 'sample upload content\n', 'utf8');
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const headers = form.getHeaders();
    const res = await (require('axios')).post('http://localhost:3000/api/upload', form, {
      headers,
      timeout: 15000,
    });

    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('originalName', 'test-upload.txt');
    expect(typeof res.data.text).toBe('string');
    expect(res.data.text.includes('sample upload content')).toBe(true);
  });
});
