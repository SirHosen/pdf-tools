
# 📄 PDF Tools Server

Server **Node.js** + **Python** untuk berbagai konversi file:

- **Word ↔ PDF**
- **JPG/PNG ↔ PDF**
- **PDF → Word**
- **Resize & Kompres PDF/JPG**

---


## ⚙️ Setup & Jalankan di Windows

### 🧩 Prasyarat

- [Node.js LTS](https://nodejs.org/) (**npm** sudah termasuk)
- [Python 3.8+](https://www.python.org/downloads/) (`python` & `pip` ada di PATH)
- [LibreOffice](https://www.libreoffice.org/download/download/)
- [Ghostscript](https://www.ghostscript.com/download/gsdnld.html)
- [Poppler for Windows](https://github.com/oschwartz10612/poppler-windows/releases)

> 💡 Tambahkan folder `bin` Poppler (misal: `C:\tools\poppler\bin`) ke **PATH** agar perintah `pdftoppm.exe` bisa dipanggil dari Command Prompt.

---

### 🚀 Langkah Setup

1. Buka **Command Prompt (cmd)** di folder root proyek.
2. Buat dan siapkan virtual environment Python:
  ```bat
  python -m venv venv
  venv\Scripts\activate
  python -m pip install --upgrade pip
  pip install -r requirements.txt
  deactivate
  ```
3. Install dependensi Node.js:
  ```bat
  npm install
  ```
4. Pastikan folder untuk upload/static tersedia:
  ```bat
  mkdir uploads
  mkdir public
  ```

---

### ▶️ Menjalankan Server

```bat
npm start
```

Server akan berjalan di: [http://localhost:5005](http://localhost:5005)

---

### ⚠️ Catatan Penting

- Jika muncul error `command not found` untuk `libreoffice`, `gs`, atau `pdftoppm`, pastikan semua sudah diinstal dan PATH sudah benar.
- Untuk LibreOffice di Windows, CLI biasanya `soffice` atau `soffice.exe` (otomatis dideteksi library backend).
- Untuk Poppler, cek dengan:
  ```bat
  pdftoppm -v
  ```
  Jika muncul versi, berarti sudah benar.

---


## 🐧 Setup & Jalankan di Linux

Server Node.js ini menyediakan endpoint untuk konversi file melalui skrip Python (`pdf2docx`, `poppler`, dll).

---


### 🧩 Prasyarat

Install paket sistem berikut (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install -y libreoffice ghostscript poppler-utils python3-venv python3-pip
# Opsional (untuk build native Node.js)
sudo apt install -y build-essential
```

**Keterangan:**

- `libreoffice` → konversi Word/Excel → PDF
- `ghostscript (gs)` → downgrade/kompres PDF (versi 1.4)
- `poppler-utils (pdftoppm)` → PDF → JPG
- `python3-venv`/`pip` → venv & instalasi `pdf2docx`

---


### 🔧 Setup Proyek

Jalankan di folder root proyek:

```bash
# 1) Virtualenv Python
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
deactivate

# 2) Dependensi Node.js
npm install

# 3) Folder upload/static
mkdir -p uploads public
```

> ⚠️ Catatan: `server.js` memanggil Python dari `./venv/bin/python`.
> Pastikan nama folder venv **tepat "venv"** dan berada di root proyek.

---


### ▶️ Menjalankan Server

```bash
npm start
```

Server akan berjalan di: [http://localhost:5005](http://localhost:5005)

> CORS default mengizinkan origin `http://localhost:5005`.
> Jika memanggil dari domain lain, ubah pengaturan CORS di `server.js`.

---


## 🧪 Uji Cepat (Contoh `curl`)

### PDF → Word

```bash
curl -X POST http://localhost:5005/convert-pdf-to-word \
  -F "pdfFile=@/path/ke/file.pdf" \
  -o converted.docx
```

### Word → PDF

```bash
curl -X POST http://localhost:5005/convert-word-to-pdf \
  -F "wordFile=@/path/ke/file.docx" \
  -o converted.pdf
```

### JPG/PNG → PDF

```bash
curl -X POST http://localhost:5005/convert-jpg-to-pdf \
  -F "imageFile=@/path/ke/gambar.jpg" \
  -o converted.pdf
```

### PDF → JPG (halaman pertama)

```bash
curl -X POST http://localhost:5005/convert-pdf-to-jpg \
  -F "pdfFile=@/path/ke/file.pdf" \
  -o converted.jpg
```

### Resize JPG

```bash
curl -X POST "http://localhost:5005/resize-jpg" \
  -F "imageFile=@/path/ke/gambar.jpg" \
  -F "width=800" \
  -F "height=600" \
  -o resized.jpg
```

### Kompres / Downgrade PDF (versi 1.4)

```bash
curl -X POST http://localhost:5005/resize-pdf \
  -F "pdfFile=@/path/ke/file.pdf" \
  -o compressed.pdf
```

---


## 🧭 Menjalankan di Background (Opsional)

Gunakan **pm2** (sudah termasuk di dependencies):

```bash
npx pm2 start server.js --name pdf-tools
npx pm2 logs pdf-tools
```

---


## 🩺 Troubleshooting Umum

| Masalah                                         | Solusi                                                                                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gs`, `libreoffice`, `pdftoppm` tidak ditemukan | Pastikan paket sistem sudah diinstal                                                                                                                                                                         |
| PDF → Word gagal karena `lxml`                  | Instal dev package lalu reinstal dependensi: <br> `sudo apt install -y libxml2-dev libxslt1-dev` <br> `source venv/bin/activate && pip install --no-cache-dir --force-reinstall lxml pdf2docx && deactivate` |
| Error `sharp` saat `npm install`                | Jalankan: `npm rebuild sharp`                                                                                                                                                                                |
| Upload gagal (ENOENT)                           | Buat folder: `mkdir -p uploads`                                                                                                                                                                              |
| Port 5005 sudah dipakai                         | Ubah konstanta `PORT` di `server.js`                                                                                                                                                                         |

---

