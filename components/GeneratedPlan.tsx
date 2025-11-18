
import React, { useState } from 'react';

interface GeneratedPlanProps {
    generatedText: string;
    onFillForm: () => void;
}

const GeneratedPlan: React.FC<GeneratedPlanProps> = ({ generatedText, onFillForm }) => {
    const [copyButtonText, setCopyButtonText] = useState('نسخ النص');
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedText).then(() => {
            setCopyButtonText('تم النسخ!');
            setTimeout(() => setCopyButtonText('نسخ النص'), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('فشل نسخ النص.');
        });
    };

    const handleExportTxt = () => {
        const blob = new Blob([generatedText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'تحضير-الدرس.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportPdf = async () => {
        setIsExportingPdf(true);
        const { jsPDF } = window.jspdf;
        
        // Create a new jsPDF instance
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        // Add the Arabic font
        // Note: jsPDF has limited Arabic support out-of-the-box. This is a basic implementation.
        // For perfect rendering, a custom font would need to be embedded.
        pdf.setFont('Tahoma', 'normal');
        pdf.setR2L(true); // Enable Right-to-Left text direction

        const margin = 15;
        const pageWidth = pdf.internal.pageSize.getWidth();
        const usableWidth = pageWidth - margin * 2;
        
        // Split text into lines that fit the page width
        const lines = pdf.splitTextToSize(generatedText, usableWidth);
        
        let y = margin;
        const lineHeight = 7; // Adjust as needed

        lines.forEach((line: string) => {
            if (y + lineHeight > pdf.internal.pageSize.getHeight() - margin) {
                pdf.addPage();
                y = margin;
            }
            pdf.text(line, pageWidth - margin, y);
            y += lineHeight;
        });

        pdf.save('تحضير-الدرس.pdf');
        setIsExportingPdf(false);
    };

    return (
        <section className="max-w-7xl mx-auto my-4 p-4 bg-white border border-gray-200 rounded-lg shadow-md">
            <h3 className="text-lg font-bold text-gray-800 mb-2">التحضير الإلكتروني المقترح:</h3>
            <div className="bg-gray-50 p-3 border rounded-md max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-semibold text-gray-700">{generatedText}</pre>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 justify-start items-center">
                <button 
                    onClick={onFillForm}
                    className="bg-green-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                >
                    تعبئة الحقول أدناه
                </button>
                 <button 
                    onClick={handleCopy}
                    className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                >
                    {copyButtonText}
                </button>
                <button 
                    onClick={handleExportTxt}
                    className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors shadow-sm"
                >
                    تصدير TXT
                </button>
                <button 
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                    className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors shadow-sm disabled:bg-red-300"
                >
                    {isExportingPdf ? 'جاري التصدير...' : 'تصدير PDF'}
                </button>
            </div>
        </section>
    );
};

export default GeneratedPlan;
