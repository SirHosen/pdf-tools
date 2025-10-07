# PDF Tools Server – Cara Menjalankan (Linux)

Server Node.js ini menyediakan beberapa endpoint untuk konversi file (Word ↔ PDF, JPG/PNG ↔ PDF, resize/kompres, dll). Ada skrip Python yang dipanggil untuk konversi PDF → Word.

## Prasyarat

Install paket sistem berikut (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install -y libreoffice ghostscript poppler-utils python3-venv python3-pip
# Opsional (kalau build native Node diperlukan)
sudo apt install -y build-essential
```

Keterangan:
- libreoffice: untuk konversi Word/Excel → PDF
- ghostscript (gs): untuk downgrade/kompres PDF (versi 1.4)
- poppler-utils (pdftoppm): untuk PDF → JPG
- python3-venv/pip: untuk membuat venv Python dan instal `pdf2docx`

## Setup proyek

Jalankan perintah berikut dari folder proyek (perhatikan ada spasi pada nama folder):

```bash
cd "/home/hosea/httpd/website convert pdf"

# 1) Buat virtualenv Python di root proyek dan install dependen Python
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
deactivate

# 2) Install dependensi Node.js
npm install

# 3) Pastikan folder upload/static ada
mkdir -p uploads public
```

Catatan penting: `server.js` memanggil Python dari `./venv/bin/python`. Pastikan Anda membuat venv dengan nama `venv` tepat di root proyek agar path tersebut valid.

## Menjalankan server

```bash
cd "/home/hosea/httpd/website convert pdf"
npm start
```

Server akan berjalan di: http://localhost:5005

CORS saat ini mengizinkan origin `http://localhost:5005`. Jika Anda memanggil dari domain/port berbeda, sesuaikan setting CORS di `server.js`.

## Uji cepat (contoh curl)

- PDF → Word (menghasilkan DOCX sebagai respons)

```bash
curl -X POST http://localhost:5005/convert-pdf-to-word \
  -F "pdfFile=@/path/ke/file.pdf" \
  -o converted.docx
```

- Word → PDF (menghasilkan PDF sebagai respons)

```bash
curl -X POST http://localhost:5005/convert-word-to-pdf \
  -F "wordFile=@/path/ke/file.docx" \
  -o converted.pdf
```

- JPG/PNG → PDF

```bash
curl -X POST http://localhost:5005/convert-jpg-to-pdf \
  -F "imageFile=@/path/ke/gambar.jpg" \
  -o converted.pdf
```

- PDF → JPG (halaman pertama)

```bash
curl -X POST http://localhost:5005/convert-pdf-to-jpg \
  -F "pdfFile=@/path/ke/file.pdf" \
  -o converted.jpg
```

- Resize JPG (tentukan width/height)

```bash
curl -X POST "http://localhost:5005/resize-jpg" \
  -F "imageFile=@/path/ke/gambar.jpg" \
  -F "width=800" -F "height=600" \
  -o resized.jpg
```

- Kompres/Downgrade PDF ke versi 1.4

```bash
curl -X POST http://localhost:5005/resize-pdf \
  -F "pdfFile=@/path/ke/file.pdf" \
  -o compressed.pdf
```

## Menjalankan di background (opsional)

Paket `pm2` sudah ada di dependencies. Anda bisa menjalankan seperti ini:

```bash
npx pm2 start server.js --name pdf-tools
npx pm2 logs pdf-tools
```

## Troubleshooting umum

- Command tidak ditemukan:
  - `gs`: install `ghostscript` (lihat prasyarat)
  - `libreoffice`: install `libreoffice`
  - `pdftoppm`: install `poppler-utils`

- PDF → Word gagal dengan error `lxml` saat install `pdf2docx`:
  - Coba install dev packages lalu ulangi install `pdf2docx`:
    ```bash
    sudo apt install -y libxml2-dev libxslt1-dev
    source venv/bin/activate && pip install --no-cache-dir --force-reinstall lxml pdf2docx && deactivate
    ```

- `sharp` error saat `npm install` (jarang, biasanya binary prebuilt tersedia):
  - Pastikan `build-essential` terinstal. Atau coba:
    ```bash
    npm rebuild sharp
    ```

- Folder `uploads` tidak ada → upload gagal (ENOENT):
  - Buat folder `uploads` secara manual: `mkdir -p uploads`

- Port 5005 sudah dipakai:
  - Ubah konstanta `PORT` di `server.js` lalu jalankan ulang.

Selamat mencoba! Jika butuh UI sederhana (HTML form) di folder `public/`, beri tahu saya, saya bisa tambahkan. 
