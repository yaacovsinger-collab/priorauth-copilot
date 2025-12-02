import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Loader, Download } from 'lucide-react';

export default function PriorAuthCoPilot() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [appealGenerated, setAppealGenerated] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(uploadedFile.type)) {
      setError('Please upload a PDF or image file (JPG, PNG)');
      return;
    }

    setFile(uploadedFile);
    setError(null);
    setExtractedData(null);
    setAppealGenerated(false);
  };

  const processDocument = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      let mediaType = file.type;
      let contentType = 'image';
      
      if (file.type === 'application/pdf') {
        contentType = 'document';
        mediaType = 'application/pdf';
      } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        mediaType = 'image/jpeg';
      } else if (file.type === 'image/png') {
        mediaType = 'image/png';
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: [
              {
                type: contentType,
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: `You are analyzing an insurance denial or prior authorization letter. Extract ALL key information and respond ONLY with a valid JSON object.

Your response must be a single JSON object with this exact structure:
{
  "patientName": "extracted patient name or empty string",
  "patientId": "member/patient ID or empty string",
  "insuranceCompany": "insurance company name or empty string",
  "denialReason": "primary reason for denial or empty string",
  "deniedService": "specific service/procedure denied or empty string",
  "denialDate": "date of denial or empty string",
  "appealDeadline": "deadline to appeal or empty string",
  "requiredDocuments": ["list of required documents"],
  "referenceNumber": "claim or reference number or empty string",
  "additionalNotes": "any other critical information or empty string"
}

Extract this information from the document. If any field cannot be determined, use an empty string or empty array.`
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      let responseText = data.content[0].text;
      responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const extracted = JSON.parse(responseText);
      setExtractedData(extracted);
      
    } catch (err) {
      console.error("Error processing document:", err);
      setError("Failed to process document. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const generateAppeal = async () => {
    if (!extractedData) return;
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          messages: [{
            role: "user",
            content: `Based on this insurance denial information, generate a professional appeal letter and submission instructions.

DENIAL DETAILS:
${JSON.stringify(extractedData, null, 2)}

Respond ONLY with valid JSON in this exact structure:
{
  "appealLetter": "full professionally written appeal letter text",
  "submissionInstructions": ["step 1", "step 2", "step 3"],
  "documentsToInclude": ["document 1", "document 2"],
  "deadlineReminder": "friendly reminder about deadline",
  "additionalTips": ["tip 1", "tip 2"]
}

The appeal letter should be formal, cite medical necessity if relevant, and request reconsideration.`
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      let responseText = data.content[0].text;
      responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const appealData = JSON.parse(responseText);
      setExtractedData({ ...extractedData, appeal: appealData });
      setAppealGenerated(true);

    } catch (err) {
      console.error("Error generating appeal:", err);
      setError("Failed to generate appeal. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const downloadAppeal = () => {
    if (!extractedData?.appeal) return;
    const content = `PRIOR AUTHORIZATION APPEAL LETTER
    
${extractedData.appeal.appealLetter}

---

SUBMISSION INSTRUCTIONS:
${extractedData.appeal.submissionInstructions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

REQUIRED DOCUMENTS:
${extractedData.appeal.documentsToInclude.map((d: string, i: number) => `• ${d}`).join('\n')}

IMPORTANT: ${extractedData.appeal.deadlineReminder}

ADDITIONAL TIPS:
${extractedData.appeal.additionalTips.map((t: string, i: number) => `• ${t}`).join('\n')}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'appeal-letter.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #f8fafc, #dbeafe, #e0e7ff)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        body { margin: 0; font-family: 'Inter', sans-serif; }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .animate-slideUp { animation: slideUp 0.5s ease-out; }
        .animate-spin { animation: spin 1s linear infinite; }
        
        .upload-zone {
          transition: all 0.3s ease;
          border: 2px dashed #cbd5e1;
          cursor: pointer;
        }
        
        .upload-zone:hover {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.05);
        }
        
        .card {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
          transition: all 0.3s ease;
        }
        
        .card:hover {
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          transform: translateY(-4px);
        }
        
        .btn {
          transition: all 0.2s ease;
          cursor: pointer;
          border: none;
          font-family: inherit;
        }
        
        .btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
        }
        
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      <div style={{ background: 'linear-gradient(to right, #2563eb, #4f46e5, #7c3aed)', color: 'white', padding: '32px 24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '700', marginBottom: '8px', margin: 0 }}>
            PriorAuth CoPilot
          </h1>
          <p style={{ color: '#dbeafe', fontSize: '18px', margin: '8px 0 0 0' }}>
            Turn insurance denials into approved appeals, instantly
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 24px' }}>
        
        {!file && (
          <div className="card animate-slideUp" style={{ padding: '48px' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', background: 'linear-gradient(to bottom right, #3b82f6, #4f46e5)', borderRadius: '50%', marginBottom: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <Upload style={{ width: '40px', height: '40px', color: 'white' }} />
              </div>
              <h2 style={{ fontSize: '30px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
                Upload Your Denial Letter
              </h2>
              <p style={{ color: '#6b7280', fontSize: '18px', maxWidth: '672px', margin: '0 auto' }}>
                Upload your insurance denial or prior authorization letter. We'll extract the details and help you file a winning appeal.
              </p>
            </div>

            <label className="upload-zone" style={{ display: 'block', width: '100%', padding: '64px', borderRadius: '12px', background: 'linear-gradient(to bottom right, #f9fafb, #dbeafe)' }}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <div style={{ textAlign: 'center' }}>
                <FileText style={{ width: '64px', height: '64px', margin: '0 auto 16px', color: '#3b82f6' }} />
                <p style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Drop your file here or click to browse
                </p>
                <p style={{ fontSize: '14px', color: '#6b7280', fontFamily: 'monospace' }}>
                  Supports PDF, JPG, PNG
                </p>
              </div>
            </label>
          </div>
        )}

        {file && !extractedData && (
          <div className="card animate-slideUp" style={{ padding: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', background: 'linear-gradient(to bottom right, #34d399, #10b981)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <FileText style={{ width: '24px', height: '24px', color: 'white' }} />
                </div>
                <div>
                  <p style={{ fontWeight: '600', color: '#111827', fontSize: '18px', margin: 0 }}>{file.name}</p>
                  <p style={{ fontSize: '14px', color: '#6b7280', fontFamily: 'monospace', margin: '4px 0 0 0' }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setExtractedData(null);
                  setError(null);
                }}
                style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '24px', cursor: 'pointer', padding: '8px' }}
              >
                ✕
              </button>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '16px', marginBottom: '24px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <AlertCircle style={{ width: '20px', height: '20px', color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ color: '#b91c1c', fontSize: '14px', margin: 0 }}>{error}</p>
                </div>
              </div>
            )}

            <button
              onClick={processDocument}
              disabled={processing}
              className="btn"
              style={{ width: '100%', padding: '16px 24px', background: 'linear-gradient(to right, #2563eb, #4f46e5)', color: 'white', borderRadius: '12px', fontWeight: '600', fontSize: '18px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
            >
              {processing ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <Loader className="animate-spin" style={{ width: '20px', height: '20px' }} />
                  Analyzing Document...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <CheckCircle style={{ width: '20px', height: '20px' }} />
                  Extract Information
                </span>
              )}
            </button>
          </div>
        )}

        {extractedData && !appealGenerated && (
          <div className="animate-slideUp" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '40px', height: '40px', background: 'linear-gradient(to bottom right, #34d399, #14b8a6)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <CheckCircle style={{ width: '20px', height: '20px', color: 'white' }} />
                </div>
                <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>
                  Extracted Information
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {extractedData.patientName && (
                  <div style={{ background: 'linear-gradient(to bottom right, #dbeafe, #e0e7ff)', padding: '16px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#1e40af', marginBottom: '4px' }}>Patient Name</p>
                    <p style={{ color: '#111827', fontWeight: '500', margin: 0 }}>{extractedData.patientName}</p>
                  </div>
                )}
                
                {extractedData.patientId && (
                  <div style={{ background: 'linear-gradient(to bottom right, #dbeafe, #e0e7ff)', padding: '16px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#1e40af', marginBottom: '4px' }}>Patient ID</p>
                    <p style={{ color: '#111827', fontWeight: '500', fontFamily: 'monospace', margin: 0 }}>{extractedData.patientId}</p>
                  </div>
                )}
                
                {extractedData.insuranceCompany && (
                  <div style={{ background: 'linear-gradient(to bottom right, #fae8ff, #fce7f3)', padding: '16px', borderRadius: '12px', border: '1px solid #e9d5ff' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#7e22ce', marginBottom: '4px' }}>Insurance Company</p>
                    <p style={{ color: '#111827', fontWeight: '500', margin: 0 }}>{extractedData.insuranceCompany}</p>
                  </div>
                )}
                
                {extractedData.referenceNumber && (
                  <div style={{ background: 'linear-gradient(to bottom right, #fae8ff, #fce7f3)', padding: '16px', borderRadius: '12px', border: '1px solid #e9d5ff' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#7e22ce', marginBottom: '4px' }}>Reference Number</p>
                    <p style={{ color: '#111827', fontWeight: '500', fontFamily: 'monospace', margin: 0 }}>{extractedData.referenceNumber}</p>
                  </div>
                )}
              </div>

              {extractedData.deniedService && (
                <div style={{ background: 'linear-gradient(to bottom right, #fed7aa, #fecaca)', padding: '20px', borderRadius: '12px', border: '1px solid #fdba74', marginTop: '24px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#9a3412', marginBottom: '8px' }}>Denied Service</p>
                  <p style={{ color: '#111827', fontWeight: '500', fontSize: '18px', margin: 0 }}>{extractedData.deniedService}</p>
                </div>
              )}

              {extractedData.denialReason && (
                <div style={{ background: 'linear-gradient(to bottom right, #fecaca, #fce7f3)', padding: '20px', borderRadius: '12px', border: '1px solid #fca5a5', marginTop: '24px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#991b1b', marginBottom: '8px' }}>Denial Reason</p>
                  <p style={{ color: '#111827', margin: 0 }}>{extractedData.denialReason}</p>
                </div>
              )}

              {extractedData.appealDeadline && (
                <div style={{ background: 'linear-gradient(to bottom right, #fef3c7, #fed7aa)', padding: '20px', borderRadius: '12px', border: '2px solid #fbbf24', marginTop: '24px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#78350f', marginBottom: '8px' }}>⚠️ Appeal Deadline</p>
                  <p style={{ color: '#111827', fontWeight: '700', fontSize: '18px', margin: 0 }}>{extractedData.appealDeadline}</p>
                </div>
              )}

              {extractedData.requiredDocuments && extractedData.requiredDocuments.length > 0 && (
                <div style={{ background: 'linear-gradient(to bottom right, #ccfbf1, #cffafe)', padding: '20px', borderRadius: '12px', border: '1px solid #5eead4', marginTop: '24px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#115e59', marginBottom: '12px' }}>Required Documents</p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {extractedData.requiredDocuments.map((doc: string, idx: number) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ color: '#0d9488', marginTop: '4px' }}>•</span>
                        <span style={{ color: '#111827' }}>{doc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {extractedData.additionalNotes && (
                <div style={{ background: 'linear-gradient(to bottom right, #f9fafb, #f1f5f9)', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1', marginTop: '24px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>Additional Notes</p>
                  <p style={{ color: '#374151', fontSize: '14px', margin: 0 }}>{extractedData.additionalNotes}</p>
                </div>
              )}
            </div>

            <button
              onClick={generateAppeal}
              disabled={processing}
              className="btn"
              style={{ width: '100%', padding: '20px 24px', background: 'linear-gradient(to right, #10b981, #14b8a6)', color: 'white', borderRadius: '12px', fontWeight: '700', fontSize: '20px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}
            >
              {processing ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <Loader className="animate-spin" style={{ width: '24px', height: '24px' }} />
                  Generating Your Appeal...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  ✨ Generate Appeal Letter
                </span>
              )}
            </button>
          </div>
        )}

        {appealGenerated && extractedData?.appeal && (
          <div className="animate-slideUp" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ padding: '32px', background: 'linear-gradient(to bottom right, #d1fae5, #ccfbf1)', border: '2px solid #6ee7b7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '48px', height: '48px', background: 'linear-gradient(to bottom right, #10b981, #14b8a6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                  <CheckCircle style={{ width: '24px', height: '24px', color: 'white' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>
                    Your Appeal is Ready!
                  </h3>
                  <p style={{ color: '#065f46', fontSize: '14px', margin: '4px 0 0 0' }}>Review and submit to your insurance company</p>
                </div>
              </div>

              <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
                <h4 style={{ fontWeight: '700', color: '#111827', marginBottom: '16px', fontSize: '18px', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px' }}>Appeal Letter</h4>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#1f2937', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                  {extractedData.appeal.appealLetter}
                </pre>
              </div>

              <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
                <h4 style={{ fontWeight: '700', color: '#111827', marginBottom: '16px', fontSize: '18px', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px' }}>📋 Submission Instructions</h4>
                <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {extractedData.appeal.submissionInstructions.map((instruction: string, idx: number) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{ flexShrink: 0, width: '24px', height: '24px', background: '#3b82f6', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700' }}>
                        {idx + 1}
                      </span>
                      <span style={{ color: '#1f2937', flex: 1 }}>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
                <h4 style={{ fontWeight: '700', color: '#111827', marginBottom: '16px', fontSize: '18px', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px' }}>📎 Documents to Include</h4>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {extractedData.appeal.documentsToInclude.map((doc: string, idx: number) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{ color: '#3b82f6' }}>✓</span>
                      <span style={{ color: '#1f2937' }}>{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {extractedData.appeal.deadlineReminder && (
                <div style={{ background: '#fef3c7', border: '2px solid #fbbf24', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
                  <p style={{ color: '#78350f', fontWeight: '600', marginBottom: '4px' }}>⚠️ Important Deadline</p>
                  <p style={{ color: '#1f2937', margin: 0 }}>{extractedData.appeal.deadlineReminder}</p>
                </div>
              )}

              <div style={{ background: '#dbeafe', padding: '20px', borderRadius: '12px' }}>
                <h4 style={{ fontWeight: '700', color: '#1e40af', marginBottom: '12px', fontSize: '14px' }}>💡 Pro Tips</h4>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {extractedData.appeal.additionalTips.map((tip: string, idx: number) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: '#3b82f6', fontSize: '12px', marginTop: '4px' }}>▸</span>
                      <span style={{ color: '#374151', fontSize: '14px' }}>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '32px', flexWrap: 'wrap' }}>
                <button
                  onClick={downloadAppeal}
                  className="btn"
                  style={{ flex: 1, minWidth: '200px', padding: '16px 24px', background: 'linear-gradient(to right, #2563eb, #4f46e5)', color: 'white', borderRadius: '12px', fontWeight: '600', fontSize: '18px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
                >
                  <Download style={{ width: '20px', height: '20px' }} />
                  Download Appeal
                </button>
                <button
                  onClick={() => {
                    setFile(null);
                    setExtractedData(null);
                    setAppealGenerated(false);
                    setError(null);
                  }}
                  className="btn"
                  style={{ padding: '16px 32px', background: '#e5e7eb', color: '#1f2937', borderRadius: '12px', fontWeight: '600', fontSize: '18px' }}
                >
                  New Appeal
                </button>
              </div>
            </div>

            <div className="card" style={{ padding: '32px', background: 'linear-gradient(to bottom right, #fae8ff, #fce7f3)', border: '1px solid #e9d5ff' }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
                  🎉 Appeal Successfully Generated!
                </h3>
                <p style={{ color: '#374151', marginBottom: '24px' }}>
                  If this appeal helps you get approved, consider supporting PriorAuth CoPilot
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'white', padding: '12px 24px', borderRadius: '9999px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <span style={{ color: '#6b7280' }}>Suggested contribution:</span>
                  <span style={{ fontSize: '24px', fontWeight: '700', color: '#7c3aed' }}>$9-15</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: '#111827', color: '#9ca3af', padding: '32px 24px', marginTop: '64px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', margin: 0 }}>
            PriorAuth CoPilot helps you fight unfair insurance denials. Not medical or legal advice.
          </p>
        </div>
      </div>
    </div>
  );
}
