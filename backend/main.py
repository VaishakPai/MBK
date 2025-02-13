from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import json
from typing import List
import pandas as pd
from io import BytesIO
import traceback

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Target headers for PDF processing
TARGET_HEADERS = ["S.S", "POL", "POD", "OPR", "2210", "4510", "45G0", "45G1", "4310", "4363", "4532", "E", "F"]

def process_pdf(pdf_file: BytesIO) -> List[pd.DataFrame]:
    try:
        extracted_tables = []

        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                words = page.extract_words()
                
                if not words:
                    continue

                # Identify column positions based on detected headers
                header_positions = []
                for word in words:
                    if word['text'] in TARGET_HEADERS:
                        header_positions.append((word['text'], word['x0'] - 5, word['x1'] + 5))

                header_positions.sort(key=lambda x: x[1])
                
                if not header_positions:
                    continue

                # Extract column boundaries and names
                column_positions = [(x[1], x[2]) for x in header_positions]
                column_names = [x[0] for x in header_positions]

                # Identify row positions and group words
                row_positions = sorted(set(word['top'] for word in words))
                table_data = []

                for y in row_positions:
                    row_data = [""] * len(column_names)

                    for word in words:
                        if abs(word['top'] - y) < 5:
                            matched_column = None
                            for col_idx, (col_x0, col_x1) in enumerate(column_positions):
                                if col_x0 <= word['x0'] <= col_x1:
                                    matched_column = col_idx
                                    break

                            if matched_column is not None and matched_column < len(row_data):
                                row_data[matched_column] += f" {word['text']}".strip()

                    if len(row_data) == len(column_names) and any(row_data):
                        table_data.append(row_data)

                # Convert to DataFrame and clean up
                if table_data:
                    df = pd.DataFrame(table_data, columns=column_names)
                    df = df.dropna(how='all')
                    df = df[~df.apply(lambda row: row.astype(str).str.contains("total", case=False, na=False)).any(axis=1)]
                    df = df.loc[df.astype(str).ne(column_names).any(axis=1)]

                    if "OPR" in df.columns:
                        df = df[df["OPR"].str.strip() != ""]

                    if not df.empty:
                        extracted_tables.append(df)

        return extracted_tables
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@app.post("/process-pdfs")
async def process_pdfs(
    pdf1: UploadFile,
    pdf2: UploadFile,
    sections: str = Form(...)
):
    try:
        sections_data = json.loads(sections)
        results = {}

        # Process first PDF
        pdf1_content = await pdf1.read()
        pdf1_tables = process_pdf(BytesIO(pdf1_content))
        
        # Process second PDF
        pdf2_content = await pdf2.read()
        pdf2_tables = process_pdf(BytesIO(pdf2_content))

        # Compare and analyze PDFs for each section
        for section, data in sections_data.items():
            section_number = data['number']
            section_date = data['date']
            
            # Example analysis (modify based on your requirements)
            pdf1_data = pd.concat(pdf1_tables) if pdf1_tables else pd.DataFrame()
            pdf2_data = pd.concat(pdf2_tables) if pdf2_tables else pd.DataFrame()
            
            # Find matching rows based on section number
            pdf1_matches = pdf1_data[pdf1_data['OPR'].str.contains(section_number, na=False)] if not pdf1_data.empty else pd.DataFrame()
            pdf2_matches = pdf2_data[pdf2_data['OPR'].str.contains(section_number, na=False)] if not pdf2_data.empty else pd.DataFrame()
            
            # Generate result for this section
            results[section] = {
                "result": f"Found {len(pdf1_matches)} matches in PDF1 and {len(pdf2_matches)} matches in PDF2 for section {section}"
            }

        return results

    except Exception as e:
        print(f"Error in process_pdfs: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))