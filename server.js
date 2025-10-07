const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const libre = require('libreoffice-convert');
const sharp = require('sharp');
const cors = require('cors');
const { PDFDocument } = require('pdf-lib');

const app = express();
const PORT = 5005;
const PYTHON_BIN = process.env.PYTHON_BIN || path.join(__dirname, 'venv', 'bin', 'python');

try {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });
    if (!fs.existsSync('public')) fs.mkdirSync('public', { recursive: true });
} catch (e) {
    console.error('Gagal membuat folder wajib:', e);
}

// CORS: izinkan origin yang sama dan local dev
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // same-origin or curl
        try {
            const u = new URL(origin);
            const allowed = (
                u.hostname === 'localhost' ||
                u.hostname === '127.0.0.1' ||
                u.hostname === '0.0.0.0'
            ) && String(u.port || '') === String(PORT);
            if (allowed) return callback(null, true);
        } catch {}
        // fallback: izinkan origin yang persis sama dengan server
        if (origin === `http://localhost:${PORT}`) return callback(null, true);
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.static('public'));
const upload = multer({ dest: 'uploads/' });

// ✅ 1. Word to PDF
app.post('/convert-word-to-pdf', upload.single('wordFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const inputPath = path.resolve(req.file.path);
    const outputExt = '.pdf';
    const tempPdfPath = `${inputPath}.pdf`;
    const finalPdfPath = `${inputPath}-final.pdf`;

    const wordBuffer = fs.readFileSync(inputPath);

    libre.convert(wordBuffer, outputExt, undefined, (err, done) => {
        fs.unlinkSync(inputPath); // Hapus file Word

        if (err) {
            console.error('LibreOffice conversion error:', err);
            return res.status(500).send('Conversion failed.');
        }

        // Simpan hasil sementara
        fs.writeFileSync(tempPdfPath, done);

        // Kompresi ke PDF 1.4 pakai Ghostscript
        const gsCommand = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dNOPAUSE -dBATCH -dQUIET -sOutputFile="${finalPdfPath}" "${tempPdfPath}"`;

        exec(gsCommand, (err, stdout, stderr) => {
            fs.unlinkSync(tempPdfPath); // Hapus hasil PDF sementara

            if (err) {
                console.error('Ghostscript error:', stderr);
                return res.status(500).send('Failed to convert to PDF 1.4.');
            }

            const finalBuffer = fs.readFileSync(finalPdfPath);
            fs.unlinkSync(finalPdfPath); // Hapus setelah dikirim

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename=converted.pdf');
            res.send(finalBuffer);
        });
    });
});

// ✅ 2. PDF to Word



app.post('/convert-pdf-to-word', upload.single('pdfFile'), (req, res) => {
    const inputPath = path.resolve(req.file.path); // path absolut ke file PDF
    const outputPath = path.resolve(`${inputPath}.docx`); // hasil .docx

    const pythonPath = PYTHON_BIN; // path ke python di virtual environment (berbasis __dirname atau ENV)
    const pythonScript = path.join(__dirname, 'convert_pdf_to_word.py'); // path ke script Python (absolute)

    const command = `${pythonPath} "${pythonScript}" "${inputPath}" "${outputPath}"`;

    console.log(`Running command: ${command}`);
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${stderr}`);
            fs.unlinkSync(inputPath); // hapus file PDF yang diupload
            return res.status(500).send('Conversion failed.');
        }

        if (!fs.existsSync(outputPath)) {
            console.error('Output file not found.');
            return res.status(500).send('Converted file not found.');
        }

        const docxBuffer = fs.readFileSync(outputPath);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'inline; filename=converted.docx');
        res.send(docxBuffer);

        // Cleanup
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
    });
});

// 🔎 Diagnostics endpoint untuk mengecek dependensi eksternal
app.get('/_diagnostics', async (req, res) => {
    const results = { ok: true, checks: {} };
    const { exec } = require('child_process');

    const run = (cmd) => new Promise((resolve) => {
        exec(cmd, { timeout: 8000 }, (error, stdout, stderr) => {
            resolve({ cmd, error: error ? String(error) : null, stdout: String(stdout).trim(), stderr: String(stderr).trim() });
        });
    });

    // Cek file/folder penting
    try {
        fs.accessSync('uploads', fs.constants.W_OK);
        results.checks.uploads_writable = true;
    } catch {
        results.ok = false;
        results.checks.uploads_writable = false;
    }
    results.checks.python_bin_path = PYTHON_BIN;
    results.checks.python_bin_exists = fs.existsSync(PYTHON_BIN);
    results.checks.python_script_exists = fs.existsSync(path.join(__dirname, 'convert_pdf_to_word.py'));

    // Versi/keberadaan tools
    results.checks.gs = await run('gs -version');
    results.checks.libreoffice = await run('libreoffice --version');
    results.checks.pdftoppm = await run('pdftoppm -v');
    // Coba import pdf2docx dari PYTHON_BIN
    const pyCmd = `"${PYTHON_BIN}" -c "import pdf2docx, sys; print(getattr(pdf2docx, '__version__', 'ok'))"`;
    results.checks.pdf2docx = await run(pyCmd);

    // Tandai gagal jika ada error penting
    const critical = ['gs', 'libreoffice', 'pdftoppm', 'pdf2docx'];
    for (const k of critical) {
        const c = results.checks[k];
        if (!c || c.error) results.ok = false;
    }

    res.json(results);
});

// ✅ 3. JPG to PDF
app.post('/convert-jpg-to-pdf', upload.single('imageFile'), async (req, res) => {
    const inputPath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const imageBytes = fs.readFileSync(inputPath);
    const tempPDFPath = `${inputPath}.temp.pdf`;
    const finalPDFPath = `${inputPath}.final.pdf`;

    try {
        const pdfDoc = await PDFDocument.create();
        let embeddedImage;

        if (ext === '.jpg' || ext === '.jpeg') {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
        } else if (ext === '.png') {
            embeddedImage = await pdfDoc.embedPng(imageBytes);
        } else {
            throw new Error('Unsupported image format');
        }

        const { width, height } = embeddedImage;
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(embeddedImage, { x: 0, y: 0, width, height });

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(tempPDFPath, pdfBytes);

        // ↓ Downgrade ke PDF versi 1.4 pakai Ghostscript
        const gsCmd = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${finalPDFPath} ${tempPDFPath}`;
        exec(gsCmd, (err, stdout, stderr) => {
            if (err) {
                console.error('Ghostscript error:', stderr);
                return res.status(500).send('Failed to convert to PDF 1.4');
            }

            const finalBuffer = fs.readFileSync(finalPDFPath);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename=converted.pdf');
            res.send(finalBuffer);

            // Cleanup
            fs.unlinkSync(inputPath);
            fs.unlinkSync(tempPDFPath);
            fs.unlinkSync(finalPDFPath);
        });

    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).send('Conversion failed');
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    }
});
// ✅ 4. PDF to JPG
app.post('/convert-pdf-to-jpg', upload.single('pdfFile'), (req, res) => {
    const inputPath = req.file.path;
    const outputBase = inputPath; // nama dasar tanpa ekstensi
    const outputJpg = `${outputBase}-1.jpg`; // karena pdftoppm nambahin -1, -2, dst

    // -singlefile penting agar hanya 1 output file (halaman pertama)
    const command = `pdftoppm "${inputPath}" "${outputBase}" -jpeg -singlefile`;

    exec(command, (err, stdout, stderr) => {
        fs.unlinkSync(inputPath); // hapus PDF input

        if (err) {
            console.error('pdftoppm error:', stderr);
            return res.status(500).send('Conversion failed.');
        }

        try {
            const jpgBuffer = fs.readFileSync(outputJpg);
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Disposition', 'inline; filename=converted.jpg');
            res.send(jpgBuffer);
            fs.unlinkSync(outputJpg); // hapus file JPG hasil konversi
        } catch (readErr) {
            console.error('Read JPG error:', readErr);
            res.status(500).send('JPG output not found.');
        }
    });
});

// ✅ 5. PNG to JPG
app.post('/convert-png-to-jpg', upload.single('pngFile'), (req, res) => {
    const inputPath = req.file.path;

    sharp(inputPath)
        .jpeg()
        .toBuffer((err, buffer) => {
            try {
                fs.unlinkSync(inputPath); // hapus file PNG asli
            } catch (unlinkErr) {
                console.error('Gagal hapus file:', unlinkErr);
            }

            if (err) {
                console.error('Sharp conversion error:', err);
                return res.status(500).send('Conversion failed.');
            }

            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Disposition', 'inline; filename=converted.jpg');
            res.send(buffer);
        });
});

// ✅ 6. Excel to PDF
app.post('/convert-excel-to-pdf', upload.single('excelFile'), (req, res) => {
    const inputPath = req.file.path;
    const outputDir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const librePdfPath = path.join(outputDir, `${baseName}.pdf`);
    const finalPdfPath = path.join(outputDir, `${baseName}-v1.4.pdf`);

    const libreCommand = `libreoffice --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`;
    const gsCommand = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dNOPAUSE -dBATCH -dQUIET -sOutputFile="${finalPdfPath}" "${librePdfPath}"`;

    exec(libreCommand, (err) => {
        fs.unlinkSync(inputPath); // hapus file excel
        if (err || !fs.existsSync(librePdfPath)) {
            return res.status(500).send('LibreOffice conversion failed.');
        }

        exec(gsCommand, (err) => {
            fs.unlinkSync(librePdfPath); // hapus file hasil awal
            if (err || !fs.existsSync(finalPdfPath)) {
                return res.status(500).send('Ghostscript conversion failed.');
            }

            const pdfBuffer = fs.readFileSync(finalPdfPath);
            fs.unlinkSync(finalPdfPath); // hapus file akhir
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename=converted.pdf');
            res.send(pdfBuffer);
        });
    });
});
// ✅ 7. Resize JPG
app.post('/resize-jpg', upload.single('imageFile'), (req, res) => {
    console.log(req.body); // Log request body untuk debugging
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    const inputPath = req.file.path;
    const { width, height } = req.body; // Ambil parameter width dan height dari body request

    // Pastikan width dan height valid
    const resizeOptions = {};
    if (width) resizeOptions.width = parseInt(width, 10);  // Pastikan width berupa angka
    if (height) resizeOptions.height = parseInt(height, 10); // Pastikan height berupa angka

    // Jika tidak ada parameter width/height, beri respons error
    if (!resizeOptions.width && !resizeOptions.height) {
        return res.status(400).send('Width or height must be provided.');
    }

    // Proses resize gambar dengan sharp
    sharp(inputPath)
        .resize(resizeOptions)
        .jpeg()
        .toBuffer((err, buffer) => {
            fs.unlinkSync(inputPath);  // Hapus file gambar yang sudah diproses
            if (err) {
                console.error('Resize failed:', err);  // Log error jika terjadi kesalahan dengan sharp
                return res.status(500).send('Resize failed.');
            }

            // Kirim hasil gambar yang sudah di-resize
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Disposition', 'inline; filename=resized.jpg');
            res.send(buffer);
        });
});


// ✅ 8. Resize PDF / Kompres
app.post('/resize-pdf', upload.single('pdfFile'), (req, res) => {
    const inputPath = req.file.path;
    const outputPath = `${inputPath}-compressed.pdf`;

    const cmd = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${outputPath} ${inputPath}`;
    exec(cmd, (err) => {
        fs.unlinkSync(inputPath);
        if (err) return res.status(500).send('Compression failed.');

        const buffer = fs.readFileSync(outputPath);
        fs.unlinkSync(outputPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=compressed.pdf');
        res.send(buffer);
    });
});

// ✅ 9. PDF Version Downgrade
app.post('/convert', upload.single('pdfFile'), (req, res) => {
    const inputPath = req.file.path;
    const outputPath = `converted_${Date.now()}.pdf`;

    const cmd = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dNOPAUSE -dBATCH -sOutputFile=${outputPath} -f ${inputPath}`;
    exec(cmd, (error) => {
        fs.unlinkSync(inputPath);
        if (error) return res.status(500).send('PDF conversion failed.');

        const buffer = fs.readFileSync(outputPath);
        fs.unlinkSync(outputPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=converted.pdf');
        res.send(buffer);
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server jalan di http://0.0.0.0:${PORT}`);
});
