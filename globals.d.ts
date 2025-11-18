// This file provides global type definitions for libraries loaded via script tags in index.html.
// This prevents TypeScript errors during the build process on platforms like Vercel.

declare global {
  interface Window {
    // Defines the structure of the jspdf object attached to the window.
    jspdf: {
      jsPDF: new (options?: any) => {
        addImage: (...args: any[]) => any;
        addPage: () => any;
        save: (filename: string) => void;
        setFont: (fontName: string, fontStyle: string) => any;
        setR2L: (enabled: boolean) => any;
        // FIX: Add `getImageProperties` to the `jspdf.jsPDF` type definition to resolve TypeScript error.
        getImageProperties: (imageData: any) => { width: number; height: number };
        internal: {
          pageSize: {
            getWidth: () => number;
            getHeight: () => number;
          };
        };
        splitTextToSize: (text: string, maxWidth: number) => string[];
        text: (
          text: string | string[],
          x: number,
          y: number,
          options?: any
        ) => any;
      };
    };
    // Defines the html2canvas function attached to the window.
    html2canvas: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
    
    // Defines pdf.js library structure
    pdfjsLib: {
        GlobalWorkerOptions: {
            workerSrc: string;
        };
        getDocument: (src: any) => {
            promise: Promise<{
                numPages: number;
                getPage: (pageNumber: number) => Promise<{
                    getTextContent: () => Promise<{
                        items: Array<{ str: string }>;
                    }>;
                }>;
            }>;
        };
    };

    // Defines xlsx (SheetJS) library structure
    XLSX: any;

    // Defines mammoth.js library structure
    mammoth: {
        extractRawText: (options: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    };
  }
}

// Add an empty export to ensure this file is treated as a module, allowing global augmentations.
export {};
