
import React, { useState, useEffect, useRef } from 'react';
import { analyzeLessonPlanWithGemini, generateFullLessonPlanWithGemini } from '../services/geminiService';
import type { LessonPlan, Objective } from '../types';
import { BloomLevelCognitive, BloomLevelAffective, BloomLevelPsychomotor } from '../types';
import { SUBJECTS, GRADES, SECTIONS, PERIODS, DAYS, INTRO_TYPES, TEACHING_METHODS, TEACHING_AIDS, SUBJECT_BRANCHES } from '../constants';
import GenerationModal from './GenerationModal';
import GeneratedPlan from './GeneratedPlan';
import { readFileAsText } from '../utils/fileUtils';
import type { GenerationFormState } from './GenerationModal';


interface LessonPlannerProps {
    onBackToWelcome: () => void;
    lesson: LessonPlan | null;
}

const initialLessonPlan: LessonPlan = {
  id: `plan-${Date.now()}`,
  emblem1: null,
  emblem2: null,
  yemenRepublic: 'الجمهورية اليمنية',
  ministry: 'وزارة التربية والتعليم',
  educationArea: '',
  schoolName: '',
  day: '',
  date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format
  subject: '',
  subjectBranch: '',
  lessonTitle: '',
  grade: '',
  section: '',
  period: '',
  behavior: 'سلوك متوقع إيجابي',
  teachingMethods: [],
  teachingAids: [],
  lessonIntro: '',
  introType: '',
  activities: '',
  cognitiveObjectives: [],
  psychomotorObjectives: [],
  affectiveObjectives: [],
  teacherRole: ['موجه ومرشد'],
  studentRole: ['مشارك ومتفاعل'],
  lessonContent: '',
  lessonClosure: '',
  closureType: '',
  homework: '',
  homeworkType: 'واجب منزلي',
  adminNotes: '',
  praise: 'ثناء وتشجيع',
  teacherName: '',
};

const ImageUploader: React.FC<{
    image: string | null;
    onImageChange: (base64: string | null) => void;
    isPrinting: boolean;
}> = ({ image, onImageChange, isPrinting }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onImageChange(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerUpload = () => inputRef.current?.click();

    return (
        <div className={`w-20 h-20 border-2 border-dashed rounded-full flex items-center justify-center ${isPrinting ? 'border-slate-400' : 'cursor-pointer hover:border-indigo-500 bg-slate-50'}`} onClick={!isPrinting ? triggerUpload : undefined}>
            <input type="file" accept="image/*" ref={inputRef} onChange={handleImageUpload} className="hidden" />
            {image ? (
                <img src={image} alt="شعار" className="w-full h-full object-cover rounded-full" />
            ) : (
                <div className="text-center text-slate-400 text-xs px-1">{isPrinting ? '' : 'تغيير الشعار'}</div>
            )}
        </div>
    );
};


const LessonPlanner: React.FC<LessonPlannerProps> = ({ onBackToWelcome, lesson }) => {
    const [lessonPlan, setLessonPlan] = useState<LessonPlan>(initialLessonPlan);
    const [analysisInputText, setAnalysisInputText] = useState('');
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    // State for the new generation feature
    const [generationInputText, setGenerationInputText] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [generatedPlan, setGeneratedPlan] = useState<{ structuredData: Partial<LessonPlan>; plainText: string; } | null>(null);
    const [teacherProfile, setTeacherProfile] = useState({});
    
    const titleStyle = { textShadow: '1px 1px 1px rgba(0,0,0,0.1)' };
    const mainTitleStyle = { textShadow: '2px 2px 3px rgba(0,0,0,0.2)', fontFamily: "'Changa', sans-serif", fontWeight: 700 };


    useEffect(() => {
        // Load teacher profile for both new plans and generation modal
        try {
            const profileJson = localStorage.getItem('teacherProfile');
            const profile = profileJson ? JSON.parse(profileJson) : {};
            setTeacherProfile(profile);

            if (lesson) {
                // Ensure roles are arrays for loaded lessons
                const loadedLesson = {
                    ...lesson,
                    teacherRole: Array.isArray(lesson.teacherRole) ? lesson.teacherRole : [lesson.teacherRole],
                    studentRole: Array.isArray(lesson.studentRole) ? lesson.studentRole : [lesson.studentRole],
                };
                setLessonPlan(loadedLesson);
            } else {
                setLessonPlan({
                    ...initialLessonPlan,
                    ...profile,
                    id: `plan-${Date.now()}`,
                });
            }
        } catch (error) {
            console.error("Failed to load data:", error);
            if (!lesson) {
                setLessonPlan({ ...initialLessonPlan, id: `plan-${Date.now()}` });
            }
        }
    }, [lesson]);
    
    const handleSave = () => {
        try {
            const plansJson = localStorage.getItem('savedLessonPlans');
            let plans: LessonPlan[] = plansJson ? JSON.parse(plansJson) : [];
            const existingPlanIndex = plans.findIndex(p => p.id === lessonPlan.id);

            if (existingPlanIndex > -1) {
                plans[existingPlanIndex] = lessonPlan;
            } else {
                plans.push(lessonPlan);
            }
            localStorage.setItem('savedLessonPlans', JSON.stringify(plans));

            // Also update the teacher profile with the latest info
            const { educationArea, schoolName, emblem1, emblem2, teacherName, subject, grade } = lessonPlan;
            const profile = { educationArea, schoolName, emblem1, emblem2, teacherName, subject, grade };
            localStorage.setItem('teacherProfile', JSON.stringify(profile));
            
            alert('تم حفظ الخطة بنجاح!');
        } catch (err) {
            console.error("Failed to save lesson plan:", err);
            alert('حدث خطأ أثناء حفظ الخطة.');
        }
    };

    const handleExportPdf = async () => {
        setIsExporting(true);
        setIsPrinting(true);
    
        setTimeout(async () => {
            const printableArea = document.getElementById('printable-area');
            if (!printableArea) {
                setIsPrinting(false);
                setIsExporting(false);
                return;
            }
            
            if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
                setAnalysisError("خطأ: مكتبات تصدير PDF لم يتم تحميلها.");
                setIsPrinting(false);
                setIsExporting(false);
                return;
            }
    
            try {
                const { jsPDF } = window.jspdf;
                const html2canvas = window.html2canvas;

                const canvas = await html2canvas(printableArea, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4',
                });

                const imgProperties = pdf.getImageProperties(imgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                const margin = 10;
                const usableWidth = pdfWidth - margin * 2;
                const usableHeight = pdfHeight - margin * 2;

                const imgWidth = imgProperties.width;
                const imgHeight = imgProperties.height;

                const ratio = imgHeight / imgWidth;
                const scaledHeight = usableWidth * ratio;

                let heightLeft = scaledHeight;
                let position = 0;

                // Add first page
                pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, scaledHeight);
                heightLeft -= usableHeight;

                // Add subsequent pages if needed
                while (heightLeft > 0) {
                    position -= usableHeight; // Shift the image up by the height of the content area
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', margin, position + margin, usableWidth, scaledHeight);
                    heightLeft -= usableHeight;
                }
                
                pdf.save(`${lessonPlan.lessonTitle || 'خطة-درس'}.pdf`);
    
            } catch (err) {
                setAnalysisError("حدث خطأ أثناء إنشاء ملف PDF.");
            } finally {
                setIsPrinting(false);
                setIsExporting(false);
            }
        }, 100);
    };

    const handleAnalyze = async () => {
        if (!analysisInputText.trim()) {
            setAnalysisError("الرجاء إدخال نص خطة الدرس للتحليل.");
            return;
        }
        setIsLoadingAnalysis(true);
        setAnalysisError(null);
        try {
            const partialPlan = await analyzeLessonPlanWithGemini(analysisInputText);
            setLessonPlan(prev => {
                const mergedPlan = { ...prev };

                const isValueEmpty = (value: any): boolean =>
                    value === null ||
                    value === undefined ||
                    (typeof value === 'string' && value.trim() === '') ||
                    (Array.isArray(value) && value.length === 0);

                (Object.keys(partialPlan) as Array<keyof Partial<LessonPlan>>).forEach(key => {
                    if (key === 'day') return;

                    const aiValue = partialPlan[key];
                    const prevValue = prev[key];
                    
                    if (!isValueEmpty(aiValue) && isValueEmpty(prevValue)) {
                        (mergedPlan as any)[key] = aiValue;
                    }
                });

                if (mergedPlan.date !== prev.date && partialPlan.day) {
                    mergedPlan.day = partialPlan.day;
                }

                return mergedPlan;
            });

        } catch (err) {
            if (err instanceof Error) {
                setAnalysisError(err.message);
            } else {
                setAnalysisError("فشل تحليل خطة الدرس. الرجاء المحاولة مرة أخرى.");
            }
        } finally {
            setIsLoadingAnalysis(false);
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'date') {
            try {
                const dateObj = new Date(value + 'T00:00:00'); 
                const dayIndex = dateObj.getUTCDay();
                const dayName = DAYS[dayIndex];
                setLessonPlan(prev => ({ ...prev, date: value, day: dayName }));
            } catch (error) {
                setLessonPlan(prev => ({ ...prev, date: value }));
            }
        } else if (name === 'teacherRole' || name === 'studentRole') {
            setLessonPlan(prev => ({ ...prev, [name]: value.split('\n') }));
        } else {
            setLessonPlan(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleCheckboxChange = (field: 'teachingMethods' | 'teachingAids', value: string) => {
        setLessonPlan(prev => {
            const currentValues = prev[field] as string[];
            const newValues = currentValues.includes(value) ? currentValues.filter(item => item !== value) : [...currentValues, value];
            return { ...prev, [field]: newValues };
        });
    };
    
    const setEmblem = (emblemNumber: 1 | 2, base64: string | null) => {
        setLessonPlan(prev => ({...prev, [`emblem${emblemNumber}`]: base64 }));
    };

    const updateObjective = (type: 'cognitive' | 'psychomotor' | 'affective', index: number, field: keyof Omit<Objective, 'id'>, value: string) => {
        const key = `${type}Objectives` as const;
        const updatedObjectives = [...lessonPlan[key]];
        updatedObjectives[index] = { ...updatedObjectives[index], [field]: value };
        setLessonPlan(prev => ({ ...prev, [key]: updatedObjectives }));
    };

    const addObjective = (type: 'cognitive' | 'psychomotor' | 'affective') => {
        const key = `${type}Objectives` as const;
        const newObjective: Objective = { id: `new-${type}-${Date.now()}`, level: '', formulation: '', evaluation: '' };
        setLessonPlan(prev => ({ ...prev, [key]: [...prev[key], newObjective] }));
    };

    const removeObjective = (type: 'cognitive' | 'psychomotor' | 'affective', id: string) => {
        const key = `${type}Objectives` as const;
        setLessonPlan(prev => ({ ...prev, [key]: prev[key].filter(obj => obj.id !== id) }));
    };

    // New Generation Feature Handlers
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setGenerationError(null);
            try {
                const text = await readFileAsText(file);
                setGenerationInputText(text);
            } catch (error: any) {
                setGenerationError(error.message || 'حدث خطأ أثناء قراءة الملف.');
            }
        }
    };
    
    const handleGenerateSubmit = async (formData: GenerationFormState) => {
        if (!generationInputText.trim()) {
            setGenerationError("الرجاء إدخال موضوع الدرس أو لصق محتواه.");
            setIsModalOpen(false);
            return;
        }
        setIsModalOpen(false);
        setIsGenerating(true);
        setGenerationError(null);
        setGeneratedPlan(null);
        try {
            const result = await generateFullLessonPlanWithGemini(generationInputText, formData);
            setGeneratedPlan(result);
        } catch (err) {
            if (err instanceof Error) {
                setGenerationError(err.message);
            } else {
                setGenerationError("فشل إنشاء خطة الدرس. الرجاء المحاولة مرة أخرى.");
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFillForm = () => {
        if (generatedPlan?.structuredData) {
            const newPlanId = `plan-${Date.now()}`;
            const profileJson = localStorage.getItem('teacherProfile');
            const profile = profileJson ? JSON.parse(profileJson) : {};
            
            setLessonPlan({
                ...initialLessonPlan,
                ...profile,
                ...generatedPlan.structuredData,
                id: newPlanId,
            });
            
            setTimeout(() => {
                document.getElementById('printable-area')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);

            alert('تم تعبئة الحقول بنجاح!');
        }
    };


    const renderObjectiveRows = (type: 'cognitive' | 'psychomotor' | 'affective', objectives: Objective[], levelEnum: any) => (
        <div className="space-y-1">
            {objectives.map((obj, index) => (
                <div key={obj.id} className="grid grid-cols-1 md:grid-cols-12 gap-1 items-start">
                    {isPrinting ? (<>
                        <p className="md:col-span-3 p-1 text-xs border rounded-md bg-slate-50 font-bold">{obj.level || '-'}</p>
                        <p className="md:col-span-5 p-1 text-xs border rounded-md bg-slate-50 font-bold">{obj.formulation || '-'}</p>
                        <p className="md:col-span-4 p-1 text-xs border rounded-md bg-slate-50 font-bold">{obj.evaluation || '-'}</p>
                    </>) : (<>
                        <select value={obj.level} onChange={(e) => updateObjective(type, index, 'level', e.target.value)} className="md:col-span-3 p-1 border rounded-md bg-white text-sm font-bold"><option value="">اختر المستوى</option>{Object.values(levelEnum).map((level: any) => <option key={level} value={level}>{level}</option>)}</select>
                        <textarea value={obj.formulation} onChange={(e) => updateObjective(type, index, 'formulation', e.target.value)} placeholder="صياغة الهدف" className="md:col-span-5 p-1 border rounded-md text-sm font-bold" rows={1} />
                        <textarea value={obj.evaluation} onChange={(e) => updateObjective(type, index, 'evaluation', e.target.value)} placeholder="أسلوب التقييم" className="md:col-span-3 p-1 border rounded-md text-sm font-bold" rows={1} />
                        <button type="button" onClick={() => removeObjective(type, obj.id)} className="md:col-span-1 bg-red-500 text-white p-1 rounded-md hover:bg-red-600 h-full text-sm">حذف</button>
                    </>)}
                </div>
            ))}
            {!isPrinting && <button type="button" onClick={() => addObjective(type)} className="mt-1 bg-green-500 text-white py-1 px-3 rounded-md hover:bg-green-600 text-sm">إضافة هدف</button>}
        </div>
    );
    

    return (
        <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen" dir="rtl">
             {!isPrinting && (
                <div className="max-w-7xl mx-auto mb-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-indigo-700">تحضير الدروس اليومية</h1>
                    <button onClick={onBackToWelcome} className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors">العودة للرئيسية</button>
                </div>
            )}
            
            {!isPrinting && (
                 <>
                    <section className="max-w-7xl mx-auto mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm">
                        <h2 className="text-xl font-semibold text-emerald-800 mb-2">1. إنشاء تحضير إلكتروني كامل (مُستحسن)</h2>
                        <p className="text-sm text-slate-600 mb-2">
                            اكتب موضوع الدرس (مثال: الفاعل في اللغة العربية) أو الصق محتوى الدرس هنا. ثم اضغط على زر الإنشاء.
                        </p>
                        <textarea 
                            className="w-full h-28 p-2 border border-slate-300 rounded-md font-bold focus:ring-2 focus:ring-emerald-500" 
                            placeholder="اكتب موضوع الدرس هنا..." 
                            value={generationInputText} 
                            onChange={(e) => setGenerationInputText(e.target.value)} 
                        />
                        <div className="mt-2 flex items-center gap-4">
                            <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-emerald-700 transition-all flex items-center">
                                أنشئ التحضير إلكترونياً
                            </button>
                            <label className="text-sm text-slate-700 cursor-pointer hover:underline">
                                أو أدرج ملف (txt, pdf, docx, xlsx)
                                <input type="file" className="hidden" accept=".txt,.pdf,.docx,.xlsx" onChange={handleFileChange} />
                            </label>
                        </div>
                    </section>

                    {isGenerating && <div className="max-w-7xl mx-auto my-4 text-center p-4 bg-white rounded-lg shadow"><p className="font-semibold text-indigo-600">جاري إنشاء التحضير، قد يستغرق هذا بضع لحظات...</p></div>}
                    {generationError && <div className="max-w-7xl mx-auto my-4 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 font-semibold">{generationError}</div>}
                    {generatedPlan && (
                        <GeneratedPlan 
                            generatedText={generatedPlan.plainText}
                            onFillForm={handleFillForm}
                        />
                    )}

                    <GenerationModal 
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onSubmit={handleGenerateSubmit}
                        teacherProfile={teacherProfile}
                    />

                    <div className="max-w-7xl mx-auto my-6 border-t-2 border-dashed border-slate-300"></div>

                    <section className="max-w-7xl mx-auto mb-4 p-4 bg-sky-50 border border-sky-200 rounded-lg shadow-sm">
                        <h2 className="text-xl font-semibold text-sky-800 mb-2">2. استخلاص المعلومات من تحضير جاهز</h2>
                        <p className="text-sm text-slate-600 mb-2">
                            لديك تحضير مكتوب بالفعل؟ الصقه هنا لاستخلاص المعلومات وتعبئة الحقول بالأسفل تلقائيًا.
                        </p>
                        <textarea className="w-full h-24 p-2 border border-slate-300 rounded-md font-bold focus:ring-2 focus:ring-sky-500" placeholder="مثال: عنوان الدرس: الفاعل. المادة: لغة عربية. الصف: الخامس..." value={analysisInputText} onChange={(e) => setAnalysisInputText(e.target.value)} />
                        <div className="mt-2 flex items-center gap-4">
                            <button onClick={handleAnalyze} disabled={isLoadingAnalysis} className="bg-sky-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-sky-700 disabled:bg-sky-300 disabled:cursor-not-allowed transition-all flex items-center">{isLoadingAnalysis ? 'جاري التحليل...' : 'تحليل النص'}</button>
                            {analysisError && <p className="text-red-600 font-semibold">{analysisError}</p>}
                        </div>
                    </section>
                </>
            )}

            <div id="printable-area" className={`max-w-7xl mx-auto bg-white rounded-lg shadow-lg ${isPrinting ? 'p-2 text-black' : 'p-4'}`}>
                <header className="grid grid-cols-3 items-center text-center font-bold border-b-2 border-slate-600 pb-2">
                    <div className="text-xs space-y-1 text-right">
                        <p className="font-bold text-red-800" style={titleStyle}>{lessonPlan.yemenRepublic}</p>
                        <p className="font-bold text-red-800" style={titleStyle}>{lessonPlan.ministry}</p>
                         {isPrinting ? <>
                            <p className="font-bold">المنطقة التعليمية: {lessonPlan.educationArea || '.........................'}</p>
                            <p className="font-bold">المــــدرســـــــــــــة: {lessonPlan.schoolName || '.........................'}</p>
                        </> : <>
                           <input type="text" name="educationArea" placeholder="المنطقة التعليمية" value={lessonPlan.educationArea} onChange={handleChange} className="p-1 border rounded-md text-right w-full text-xs font-bold" />
                           <input type="text" name="schoolName" placeholder="اسم المدرسة" value={lessonPlan.schoolName} onChange={handleChange} className="p-1 border rounded-md text-right w-full text-xs font-bold" />
                        </>}
                    </div>
                    <div className="flex justify-center items-center gap-4">
                        <ImageUploader image={lessonPlan.emblem1} onImageChange={(img) => setEmblem(1, img)} isPrinting={isPrinting} />
                        <ImageUploader image={lessonPlan.emblem2} onImageChange={(img) => setEmblem(2, img)} isPrinting={isPrinting} />
                    </div>
                    <div className="text-xs space-y-1 text-left">
                        {/* Empty on purpose for layout */}
                    </div>
                </header>
                
                <h2 className="text-3xl font-bold text-center my-2 text-blue-900" style={mainTitleStyle}>خطة الدرس اليومي</h2>

                <section className="p-2 border rounded-lg mb-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-2 gap-y-1 text-xs items-center">
                        <div className="flex items-baseline gap-1"><label className="font-bold text-red-800" style={titleStyle}>المادة:</label>{isPrinting ? <p className="font-bold">{lessonPlan.subject}</p> : <><input name="subject" value={lessonPlan.subject} onChange={handleChange} list="subjects-list" className="p-1 border rounded-md w-full text-xs font-bold" /><datalist id="subjects-list">{SUBJECTS.map(s => <option key={s} value={s}/>)}</datalist></>}</div>
                        <div className="flex items-baseline gap-1"><label className="font-bold text-red-800" style={titleStyle}>فرع المادة:</label>{isPrinting ? <p className="font-bold">{lessonPlan.subjectBranch}</p> : <><input name="subjectBranch" value={lessonPlan.subjectBranch} onChange={handleChange} list={`branches-${lessonPlan.subject}`} className="p-1 border rounded-md w-full text-xs font-bold" /><datalist id={`branches-${lessonPlan.subject}`}>{ (SUBJECT_BRANCHES[lessonPlan.subject] || []).map(s => <option key={s} value={s} />)}</datalist></>}</div>
                        <div className="flex items-baseline gap-1"><label className="font-bold text-red-800" style={titleStyle}>عنوان الدرس:</label>{isPrinting ? <p className="font-bold">{lessonPlan.lessonTitle}</p> : <input name="lessonTitle" value={lessonPlan.lessonTitle} onChange={handleChange} className="p-1 border rounded-md w-full text-xs font-bold" />}</div>
                        <div className="flex items-baseline gap-1"><label className="font-bold text-red-800" style={titleStyle}>الصف:</label>{isPrinting ? <p className="font-bold">{lessonPlan.grade}</p> : <><input name="grade" value={lessonPlan.grade} onChange={handleChange} list="grades-list" className="p-1 border rounded-md w-full text-xs font-bold" /><datalist id="grades-list">{GRADES.map(s => <option key={s} value={s}/>)}</datalist></>}</div>
                        <div className="flex items-baseline gap-1"><label className="font-bold text-red-800" style={titleStyle}>الشعبة:</label>{isPrinting ? <p className="font-bold">{lessonPlan.section}</p> : <><input name="section" value={lessonPlan.section} onChange={handleChange} list="sections-list" className="p-1 border rounded-md w-full text-xs font-bold" /><datalist id="sections-list">{SECTIONS.map(s => <option key={s} value={s}/>)}</datalist></>}</div>
                        <div className="flex items-baseline gap-1"><label className="font-bold text-red-800" style={titleStyle}>اليوم:</label>{isPrinting ? <p className="font-bold">{lessonPlan.day}</p> : <><input name="day" value={lessonPlan.day} onChange={handleChange} list="days-list" className="p-1 border rounded-md w-full text-xs font-bold" /><datalist id="days-list">{DAYS.map(s => <option key={s} value={s}/>)}</datalist></>}</div>
                        <div className="flex items-baseline gap-1"><label className="font-bold text-red-800" style={titleStyle}>التاريخ:</label>{isPrinting ? <p className="font-bold">{lessonPlan.date}</p> : <input type="date" name="date" value={lessonPlan.date} onChange={handleChange} className="p-1 border rounded-md w-full text-xs font-bold" />}</div>
                        <div className="flex items-baseline gap-1"><label className="font-bold text-red-800" style={titleStyle}>الحصة:</label>{isPrinting ? <p className="font-bold">{lessonPlan.period}</p> : <><input name="period" value={lessonPlan.period} onChange={handleChange} list="periods-list" className="p-1 border rounded-md w-full text-xs font-bold" /><datalist id="periods-list">{PERIODS.map(s => <option key={s} value={s}/>)}</datalist></>}</div>
                    </div>
                </section>
                
                <form className="space-y-2" onSubmit={(e) => e.preventDefault()}>
                    <section className="p-2 border rounded-lg space-y-2">
                        <h3 className="text-base font-bold text-red-800 border-b pb-1" style={titleStyle}>الأهداف السلوكية</h3>
                        <div><h4 className="font-bold text-red-800 mb-1 text-sm" style={titleStyle}>الأهداف المعرفية (العقلية)</h4>{renderObjectiveRows('cognitive', lessonPlan.cognitiveObjectives, BloomLevelCognitive)}</div>
                        <div><h4 className="font-bold text-red-800 mb-1 text-sm" style={titleStyle}>الأهداف المهارية (النفس حركية)</h4>{renderObjectiveRows('psychomotor', lessonPlan.psychomotorObjectives, BloomLevelPsychomotor)}</div>
                        <div><h4 className="font-bold text-red-800 mb-1 text-sm" style={titleStyle}>الأهداف الوجدانية (الانفعالية)</h4>{renderObjectiveRows('affective', lessonPlan.affectiveObjectives, BloomLevelAffective)}</div>
                    </section>

                    <section className="p-2 border rounded-lg space-y-2">
                        <h3 className="text-base font-bold text-red-800 border-b pb-1" style={titleStyle}>الوسائل والاستراتيجيات</h3>
                        <div>
                            <h4 className="font-bold text-red-800 mb-1 text-sm" style={titleStyle}>طرق التدريس</h4>
                            {isPrinting ? <div className="p-1 bg-slate-50 rounded-md text-xs font-bold">{lessonPlan.teachingMethods.join('، ')}</div> : (
                                <div className="space-y-2">
                                    {Object.entries(TEACHING_METHODS).map(([category, methods]) => (
                                        <div key={category}>
                                            <p className="font-medium text-slate-600 text-xs mb-1">{category}</p>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                                                {(methods as string[]).map(method => (
                                                    <label key={method} className="flex items-center space-x-1 space-x-reverse">
                                                        <input type="checkbox" checked={lessonPlan.teachingMethods.includes(method)} onChange={() => handleCheckboxChange('teachingMethods', method)} className="rounded" />
                                                        <span className="text-xs">{method}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <h4 className="font-bold text-red-800 mb-1 text-sm" style={titleStyle}>الوسائل التعليمية</h4>
                            {isPrinting ? <div className="p-1 bg-slate-50 rounded-md text-xs font-bold">{lessonPlan.teachingAids.join('، ')}</div> : <div className="space-y-2">{Object.entries(TEACHING_AIDS).map(([cat, aids]) => (<div key={cat}><p className="font-medium text-slate-600 text-xs mb-1">{cat}</p><div className="grid grid-cols-2 md:grid-cols-4 gap-1">{aids.map(aid => (<label key={aid} className="flex items-center space-x-1 space-x-reverse"><input type="checkbox" checked={lessonPlan.teachingAids.includes(aid)} onChange={() => handleCheckboxChange('teachingAids', aid)} className="rounded" /><span className="text-xs">{aid}</span></label>))}</div></div>))}</div>}
                        </div>
                    </section>
                    
                    <section className="p-2 border rounded-lg space-y-2">
                        <h3 className="text-base font-bold text-red-800 border-b pb-1" style={titleStyle}>سير الدرس</h3>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div className="md:col-span-2"><label className="font-bold text-red-800 mb-1 block text-sm" style={titleStyle}>التمهيد</label>{isPrinting ? <div className="w-full p-1.5 border rounded-md bg-slate-50 whitespace-pre-wrap font-bold text-xs">{lessonPlan.lessonIntro || ''}</div> : <textarea name="lessonIntro" value={lessonPlan.lessonIntro} onChange={handleChange} rows={2} className="w-full p-1 border rounded-md text-sm font-bold"></textarea>}</div>
                            <div><label className="font-bold text-red-800 mb-1 block text-sm" style={titleStyle}>نوع التمهيد</label>{isPrinting ? <div className="p-1.5 border rounded-md bg-slate-50 flex items-center text-xs font-bold">{lessonPlan.introType}</div> : <><input name="introType" value={lessonPlan.introType} onChange={handleChange} list="intro-types-list" className="w-full p-2 border rounded-md text-sm font-bold" /><datalist id="intro-types-list">{INTRO_TYPES.map(s => <option key={s} value={s}/>)}</datalist></>}</div>
                        </div>
                         <div><label className="font-bold text-red-800 mb-1 block text-sm" style={titleStyle}>محتوى الدرس والأنشطة</label>{isPrinting ? <div className="w-full p-1.5 border rounded-md bg-slate-50 whitespace-pre-wrap font-bold text-xs">{lessonPlan.lessonContent || ''}</div> : <textarea name="lessonContent" value={lessonPlan.lessonContent} onChange={handleChange} rows={4} className="w-full p-1 border rounded-md text-sm font-bold"></textarea>}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                                <label className="font-bold text-red-800 mb-1 block text-sm" style={titleStyle}>أدوار المعلم</label>
                                {isPrinting ? (
                                    <ul className="list-disc list-inside bg-slate-50 p-2 rounded-md space-y-1 border text-xs font-bold">
                                        {lessonPlan.teacherRole && lessonPlan.teacherRole.length > 0 ?
                                            lessonPlan.teacherRole.map((role, index) => <li key={`tr-${index}`}>{role}</li>) :
                                            <li className="text-slate-400">لا توجد أدوار محددة.</li>
                                        }
                                    </ul>
                                ) : (
                                    <textarea name="teacherRole" value={lessonPlan.teacherRole.join('\n')} onChange={handleChange} rows={4} className="w-full p-1 border rounded-md text-sm font-bold"></textarea>
                                )}
                            </div>
                            <div>
                                <label className="font-bold text-red-800 mb-1 block text-sm" style={titleStyle}>أدوار الطالب</label>
                                {isPrinting ? (
                                     <ul className="list-disc list-inside bg-slate-50 p-2 rounded-md space-y-1 border text-xs font-bold">
                                        {lessonPlan.studentRole && lessonPlan.studentRole.length > 0 ?
                                            lessonPlan.studentRole.map((role, index) => <li key={`sr-${index}`}>{role}</li>) :
                                            <li className="text-slate-400">لا توجد أدوار محددة.</li>
                                        }
                                    </ul>
                                ) : (
                                    <textarea name="studentRole" value={lessonPlan.studentRole.join('\n')} onChange={handleChange} rows={4} className="w-full p-1 border rounded-md text-sm font-bold"></textarea>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="p-2 border rounded-lg space-y-2">
                        <h3 className="text-base font-bold text-red-800 border-b pb-1" style={titleStyle}>التقويم والخاتمة</h3>
                        <div><label className="font-bold text-red-800 mb-1 block text-sm" style={titleStyle}>الخاتمة والتقويم</label>{isPrinting ? <div className="w-full p-1.5 border rounded-md bg-slate-50 whitespace-pre-wrap font-bold text-xs">{lessonPlan.lessonClosure || ''}</div> : <textarea name="lessonClosure" value={lessonPlan.lessonClosure} onChange={handleChange} rows={2} className="w-full p-1 border rounded-md text-sm font-bold"></textarea>}</div>
                        <div><label className="font-bold text-red-800 mb-1 block text-sm" style={titleStyle}>الواجب المنزلي</label>{isPrinting ? <div className="w-full p-1.5 border rounded-md bg-slate-50 whitespace-pre-wrap font-bold text-xs">{lessonPlan.homework || ''}</div> : <textarea name="homework" value={lessonPlan.homework} onChange={handleChange} rows={2} className="w-full p-1 border rounded-md text-sm font-bold"></textarea>}</div>
                    </section>

                    <footer className="pt-2">
                        <div className="text-left text-xs font-bold">
                            {isPrinting ? 
                                <p className="font-bold">المعلم/ة: {lessonPlan.teacherName || '.........................'}</p> : 
                                <div className="flex items-center justify-end gap-2">
                                    <label className="font-bold text-red-800" style={titleStyle}>اسم المعلم/ة:</label>
                                    <input type="text" name="teacherName" placeholder="اسم المعلم" value={lessonPlan.teacherName} onChange={handleChange} className="p-1 border rounded-md text-right w-1/3 text-xs font-bold" />
                                </div>
                            }
                        </div>
                    </footer>
                </form>
            </div>
            
             {!isPrinting &&
                <div className="flex justify-end mt-4 max-w-7xl mx-auto space-x-4 space-x-reverse">
                    <button type="button" onClick={handleSave} className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors">حفظ الخطة</button>
                    <button type="button" onClick={handleExportPdf} disabled={isExporting} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-300 flex items-center justify-center min-w-[140px]">
                        {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
                    </button>
                </div>
            }
        </div>
    );
};

export default LessonPlanner;