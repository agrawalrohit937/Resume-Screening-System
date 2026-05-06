import { useState } from "react";
import { generatePDF } from "../services/api";
import toast from "react-hot-toast";

export default function ResumeDownload({ resumeId, isParsed = true }) {
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setPdfUrl(null);

    try {
      const response = await generatePDF({ resume_id: resumeId, template: "modern" });
      
if (response.success) {
        setPdfUrl(response.pdf_url);
        toast.success("Resume PDF generated successfully!");
        // Automatically open PDF in new tab
        window.open(response.pdf_url, '_blank');
      } else {
        throw new Error(response.message || "PDF generation failed");
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || "PDF generation failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isParsed) return null;

  return (
    <div className="flex flex-col gap-3">
      {!pdfUrl ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating PDF…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Download ATS Resume (PDF)
            </>
          )}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="badge-blue">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Resume ready!
            </span>
          </div>
          <div className="flex gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </a>
            <button
              onClick={() => setPdfUrl(null)}
              className="btn-ghost"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.582 0A4 4 0 014.582 9m0 0H9m11 11v-5h-.581m0 0a4 4 0 01-4.582-9m0 0H9" />
              </svg>
              Regenerate
            </button>
          </div>
        </div>
      )}
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
