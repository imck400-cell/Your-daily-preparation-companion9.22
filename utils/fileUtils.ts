
export const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        const fileType = file.type;
        const fileName = file.name.toLowerCase();

        // Read as ArrayBuffer for binary files
        if (
            fileType.includes('pdf') ||
            fileType.includes('sheet') || // xlsx
            fileType.includes('excel') ||
            fileName.endsWith('.xlsx') ||
            fileName.endsWith('.xls') ||
            fileType.includes('wordprocessingml.document') || // docx
            fileName.endsWith('.docx')
        ) {
            reader.onload = async (event) => {
                if (event.target?.result) {
                    try {
                        const arrayBuffer = event.target.result as ArrayBuffer;
                        
                        // Handle PDF
                        if (fileType.includes('pdf')) {
                            const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
                            let text = '';
                            for (let i = 1; i <= pdf.numPages; i++) {
                                const page = await pdf.getPage(i);
                                const textContent = await page.getTextContent();
                                text += textContent.items.map(item => item.str).join(' ') + '\n';
                            }
                            resolve(text);
                        }
                        // Handle Excel
                        else if (
                            fileType.includes('sheet') ||
                            fileType.includes('excel') ||
                            fileName.endsWith('.xlsx') ||
                            fileName.endsWith('.xls')
                        ) {
                             const workbook = window.XLSX.read(arrayBuffer, { type: 'buffer' });
                             const sheetName = workbook.SheetNames[0];
                             const worksheet = workbook.Sheets[sheetName];
                             const csvText = window.XLSX.utils.sheet_to_csv(worksheet);
                             resolve(csvText);
                        }
                        // Handle Word
                        else if (
                            fileType.includes('wordprocessingml.document') ||
                            fileName.endsWith('.docx')
                        ) {
                            const result = await window.mammoth.extractRawText({ arrayBuffer });
                            resolve(result.value);
                        }
                        
                    } catch (error) {
                        console.error('Error processing file:', error);
                        reject(new Error('فشل في معالجة الملف. قد يكون الملف تالفًا.'));
                    }
                } else {
                    reject(new Error('فشل في قراءة الملف: الملف فارغ.'));
                }
            };
            reader.readAsArrayBuffer(file);
        }
        // Handle plain text
        else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
             reader.onload = (event) => {
                if (event.target?.result) {
                    resolve(event.target.result as string);
                } else {
                    reject(new Error('فشل في قراءة الملف: الملف فارغ.'));
                }
            };
            reader.readAsText(file, 'UTF-8');
        } 
        // Unsupported file type
        else {
            reject(new Error(`نوع الملف (${file.name}) غير مدعوم. يرجى استخدام ملف نصي أو PDF أو Word أو Excel.`));
        }

        reader.onerror = () => {
            reject(new Error('حدث خطأ أثناء قراءة الملف.'));
        };
    });
};
