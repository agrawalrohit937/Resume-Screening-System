"""
PDF Generator Service — Compile LaTeX to PDF, upload via FTP
"""

import io
import os
import shutil
import subprocess
import tempfile
from datetime import datetime
from ftplib import FTP

import structlog

from models.resume_model import ResumeModel
from core.config import settings
from services.latex_template_service import build_latex

logger = structlog.get_logger(__name__)


def upload_to_ftp(local_file_path: str, remote_filename: str) -> str:
    try:
        logger.info("FTP connecting", host=settings.FTP_HOST)
        ftp = FTP()
        ftp.connect(settings.FTP_HOST, settings.FTP_PORT, timeout=20)
        ftp.login(settings.FTP_USERNAME, settings.FTP_PASSWORD)
        ftp.set_pasv(True)

        ftp.cwd("domains/generativeaix.com/public_html")

        folders = ftp.nlst()
        if "ats_resume" not in folders:
            ftp.mkd("ats_resume")
        ftp.cwd("ats_resume")

        with open(local_file_path, "rb") as f:
            ftp.storbinary(f"STOR {remote_filename}", f)

        ftp.quit()

        url = f"{settings.FTP_BASE_URL}/ats_resume/{remote_filename}"
        logger.info("FTP upload complete", url=url)
        return url

    except Exception as e:
        logger.error("FTP upload failed", error=str(e))
        raise Exception(f"FTP upload failed: {str(e)}")


class PDFGeneratorService:

    async def generate_resume_pdf(
        self,
        resume: ResumeModel,
        output_path: str,
        template: str = "modern",
    ) -> str:
        if not resume.parsed_data:
            raise ValueError("Resume must be parsed before PDF generation.")

        parsed = resume.parsed_data

        # 1. Build LaTeX source
        latex_source = build_latex(parsed)

        # 2. Compile in a temp directory (pdflatex needs to write aux files)
        pdf_bytes = self._compile_latex(latex_source)

        # 3. Write PDF to output path
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)

        logger.info("PDF written", path=output_path, size=len(pdf_bytes))

        # 4. Upload to FTP
        filename = os.path.basename(output_path)
        pdf_url = upload_to_ftp(output_path, filename)
        return pdf_url

    def _compile_latex(self, latex_source: str) -> bytes:
        """Write .tex to a temp dir, run pdflatex twice (for proper refs), return PDF bytes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tex_path = os.path.join(tmpdir, "resume.tex")

            with open(tex_path, "w", encoding="utf-8") as f:
                f.write(latex_source)

            cmd = [
                "pdflatex",
                "-interaction=nonstopmode",
                "-output-directory", tmpdir,
                tex_path,
            ]

            # Run twice so hyperref and titlerule refs resolve correctly
            for run in range(2):
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
                if result.returncode != 0:
                    logger.error(
                        "pdflatex failed",
                        run=run + 1,
                        stdout=result.stdout[-2000:],
                        stderr=result.stderr[-500:],
                    )
                    raise RuntimeError(
                        f"LaTeX compilation failed (run {run+1}):\n"
                        + result.stdout[-1500:]
                    )

            pdf_path = os.path.join(tmpdir, "resume.pdf")
            if not os.path.exists(pdf_path):
                raise RuntimeError("pdflatex ran but no PDF was produced.")

            with open(pdf_path, "rb") as f:
                return f.read()