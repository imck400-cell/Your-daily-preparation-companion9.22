
import React, { useState, useEffect } from 'react';
import { SUBJECTS, GRADES, SECTIONS, PERIODS, DAYS, SUBJECT_BRANCHES } from '../constants';

export interface GenerationFormState {
    educationArea: string;
    schoolName: string;
    subject: string;
    subjectBranch: string;
    lessonTitle: string;
    grade: string;
    section: string;
    day: string;
    date: string;
    period: string;
    teacherName: string;
}

interface GenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: GenerationFormState) => void;
    teacherProfile: Partial<GenerationFormState & { subject: string, grade: string }>;
}

const GenerationModal: React.FC<GenerationModalProps> = ({ isOpen, onClose, onSubmit, teacherProfile }) => {
    const [formData, setFormData] = useState<GenerationFormState>({
        educationArea: '',
        schoolName: '',
        subject: '',
        subjectBranch: '',
        lessonTitle: '',
        grade: '',
        section: '',
        day: DAYS[new Date().getDay()],
        date: new Date().toLocaleDateString('en-CA'),
        period: '',
        teacherName: '',
    });

    useEffect(() => {
        if (teacherProfile) {
            setFormData(prev => ({
                ...prev,
                educationArea: teacherProfile.educationArea || '',
                schoolName: teacherProfile.schoolName || '',
                teacherName: teacherProfile.teacherName || '',
                subject: teacherProfile.subject || '',
                grade: teacherProfile.grade || '',
            }));
        }
    }, [teacherProfile]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'date') {
            const dateObj = new Date(value + 'T00:00:00');
            const dayName = DAYS[dateObj.getUTCDay()];
            setFormData(prev => ({ ...prev, date: value, day: dayName }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const subjectBranches = SUBJECT_BRANCHES[formData.subject] || [];

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">تفاصيل إنشاء الدرس</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">المنطقة التعليمية</label>
                            <input type="text" name="educationArea" value={formData.educationArea} onChange={handleChange} className="w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">اسم المدرسة</label>
                            <input type="text" name="schoolName" value={formData.schoolName} onChange={handleChange} className="w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">المادة <span className="text-red-500">*</span></label>
                            <input type="text" name="subject" value={formData.subject} onChange={handleChange} list="subjects-list-modal" required className="w-full p-2 border rounded-md" placeholder="اختر أو اكتب مادة"/>
                            <datalist id="subjects-list-modal">
                                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">فرع المادة</label>
                            <input type="text" name="subjectBranch" value={formData.subjectBranch} onChange={handleChange} list="subject-branches-list" placeholder="اختر أو اكتب فرعًا" className="w-full p-2 border rounded-md" />
                            <datalist id="subject-branches-list">
                                {subjectBranches.map(s => <option key={s} value={s}>{s}</option>)}
                            </datalist>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">عنوان الدرس <span className="text-red-500">*</span></label>
                            <input type="text" name="lessonTitle" value={formData.lessonTitle} onChange={handleChange} required className="w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الصف <span className="text-red-500">*</span></label>
                            <input type="text" name="grade" value={formData.grade} onChange={handleChange} list="grades-list" required className="w-full p-2 border rounded-md" placeholder="اختر أو اكتب صفًا"/>
                             <datalist id="grades-list">
                                {GRADES.map(s => <option key={s} value={s}>{s}</option>)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الشعبة</label>
                            <input type="text" name="section" value={formData.section} onChange={handleChange} list="sections-list" className="w-full p-2 border rounded-md" placeholder="اختر أو اكتب شعبة"/>
                            <datalist id="sections-list">
                                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </datalist>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
                            <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">اليوم</label>
                            <input type="text" name="day" value={formData.day} readOnly className="w-full p-2 border rounded-md bg-gray-100" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الحصة</label>
                             <input type="text" name="period" value={formData.period} onChange={handleChange} list="periods-list" className="w-full p-2 border rounded-md" placeholder="اختر أو اكتب حصة"/>
                            <datalist id="periods-list">
                                {PERIODS.map(s => <option key={s} value={s}>{s}</option>)}
                            </datalist>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">اسم المعلم/ة</label>
                            <input type="text" name="teacherName" value={formData.teacherName} onChange={handleChange} className="w-full p-2 border rounded-md" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-lg hover:bg-gray-300">
                            إلغاء
                        </button>
                        <button type="submit" className="bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-emerald-700">
                            ابدأ التحضير إلكترونياً
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GenerationModal;