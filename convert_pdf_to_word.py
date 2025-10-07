# convert_pdf_to_word.py
import sys
from pdf2docx import Converter

pdf_path = sys.argv[1]
docx_path = sys.argv[2]

cv = Converter(pdf_path)
cv.convert(docx_path, start=0, end=None)
cv.close()
