import pdfplumber


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from PDF file using pdfplumber.
    Returns the extracted text as a single string.
    """
    text_parts = []

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)

    return "\n\n".join(text_parts)
