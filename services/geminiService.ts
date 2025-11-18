import { GoogleGenAI, Type } from "@google/genai";
import type { LessonPlan, Objective } from '../types';
import type { GenerationFormState } from "../components/GenerationModal";
import { TEACHING_METHODS, TEACHING_AIDS } from "../constants";

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// This function converts a lesson plan text into a structured JSON object.
export async function analyzeLessonPlanWithGemini(lessonText: string): Promise<Partial<LessonPlan>> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("لم يتم تكوين مفتاح Gemini API. يرجى التأكد من إعداده في متغيرات بيئة النشر.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const objectiveSchema = {
        type: Type.OBJECT,
        properties: {
            level: { type: Type.STRING, description: "The Bloom's Taxonomy level of the objective." },
            formulation: { type: Type.STRING, description: "The exact wording of the behavioral objective." },
            evaluation: { type: Type.STRING, description: "The method or question to evaluate if the objective was met." },
        },
        required: ["level", "formulation", "evaluation"]
    };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            lessonTitle: { type: Type.STRING, description: "The main title of the lesson." },
            subject: { type: Type.STRING, description: "The subject matter (e.g., 'اللغة العربية')." },
            subjectBranch: { type: Type.STRING, description: "The specific branch of the subject (e.g., 'نحو', 'جبر')." },
            grade: { type: Type.STRING, description: "The target grade level (e.g., 'الصف الخامس الابتدائي')." },
            educationArea: { type: Type.STRING, description: "The educational area or district (e.g., 'مكتب التربية بأمانة العاصمة')." },
            schoolName: { type: Type.STRING, description: "The name of the school." },
            teacherName: { type: Type.STRING, description: "The name of the teacher." },
            section: { type: Type.STRING, description: "The class section (e.g., 'أ', 'ب', '1')." },
            period: { type: Type.STRING, description: "The class period (e.g., 'الأولى', 'الثانية')." },
            date: { type: Type.STRING, description: "The date of the lesson in YYYY-MM-DD format." },
            teachingMethods: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of teaching methods and strategies used."},
            teachingAids: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of teaching aids or materials mentioned."},
            lessonIntro: { type: Type.STRING, description: "A summary of the lesson's introduction or warm-up activity." },
            introType: { type: Type.STRING, description: "The type of introduction (e.g., 'سؤال', 'قصة')." },
            cognitiveObjectives: { type: Type.ARRAY, items: objectiveSchema, description: "List of cognitive objectives from the lesson plan." },
            psychomotorObjectives: { type: Type.ARRAY, items: objectiveSchema, description: "List of psychomotor (skill-based) objectives." },
            affectiveObjectives: { type: Type.ARRAY, items: objectiveSchema, description: "List of affective (emotional/value-based) objectives." },
            teacherRole: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of the teacher's roles during the lesson."},
            studentRole: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of the student's roles during the lesson."},
            lessonContent: { type: Type.STRING, description: "A detailed summary of the core content and activities of the lesson." },
            lessonClosure: { type: Type.STRING, description: "A summary of the lesson's closing activity."},
            homework: { type: Type.STRING, description: "The homework assignment given to students." },
        },
    };

    const prompt = `
    You are an expert educational assistant specializing in analyzing and structuring lesson plans for Yemeni teachers.
    Your task is to analyze the following lesson plan text and extract the required information into a structured JSON format.
    You must analyze the provided lesson text and fill in all fields in the JSON schema. If a specific detail is missing from the text, you MUST infer and generate appropriate, logical content based on the lesson's subject, grade level, and topic. For example, for a 5th-grade Arabic lesson about poetry, you might suggest 'whiteboard, markers, poetry anthology' as teaching aids. Do not leave any fields empty; provide logical and relevant suggestions for all of them. Ensure the objectives you generate are well-formed and appropriate for the lesson.
    For the 'date' field, ensure it is in YYYY-MM-DD format. Do not include the 'day' field in your JSON output; it will be calculated automatically.

    The lesson plan is:
    ---
    ${lessonText}
    ---
    Please extract the information according to the provided JSON schema.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const jsonString = response.text.trim();
        const parsedResult = JSON.parse(jsonString) as Partial<LessonPlan>;
        
        type ObjectiveBase = Omit<Objective, 'id'>;

        parsedResult.cognitiveObjectives = ((parsedResult.cognitiveObjectives as ObjectiveBase[]) || []).map((o, i) => ({ ...o, id: `cog-${Date.now()}-${i}` }));
        parsedResult.psychomotorObjectives = ((parsedResult.psychomotorObjectives as ObjectiveBase[]) || []).map((o, i) => ({ ...o, id: `psy-${Date.now()}-${i}` }));
        parsedResult.affectiveObjectives = ((parsedResult.affectiveObjectives as ObjectiveBase[]) || []).map((o, i) => ({ ...o, id: `aff-${Date.now()}-${i}` }));
        
        if (parsedResult.date) {
            try {
                const dateObj = new Date(parsedResult.date + 'T00:00:00');
                const dayIndex = dateObj.getUTCDay();
                parsedResult.day = DAYS[dayIndex];
            } catch (e) {
                console.warn("Could not parse date from AI response to set day.", e);
            }
        }

        return parsedResult;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error && error.message.includes('API key not valid')) {
             throw new Error("مفتاح API غير صالح. يرجى التحقق من المفتاح في إعدادات البيئة الخاصة بك.");
        }
        throw new Error("فشل تحليل خطة الدرس. يرجى المحاولة مرة أخرى أو التحقق من مفتاح API.");
    }
}


// New function to GENERATE a full lesson plan
export async function generateFullLessonPlanWithGemini(
    lessonContent: string,
    details: GenerationFormState
): Promise<{ structuredData: Partial<LessonPlan>; plainText: string; }> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("لم يتم تكوين مفتاح Gemini API. يرجى التأكد من إعداده في متغيرات بيئة النشر.");
    }
    const ai = new GoogleGenAI({ apiKey });

    // Reusing the objective schema from the analyze function
    const objectiveSchema = {
        type: Type.OBJECT,
        properties: {
            level: { type: Type.STRING, description: "مستوى الهدف حسب تصنيف بلوم (مثال: التذكر, الفهم)." },
            formulation: { type: Type.STRING, description: "الصياغة السلوكية للهدف (مثال: أن يعدد الطالب...)." },
            evaluation: { type: Type.STRING, description: "أسلوب تقييم الهدف (مثال: سؤال مباشر, ملاحظة الأداء)." },
        },
        required: ["level", "formulation", "evaluation"]
    };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            teachingMethods: { type: Type.ARRAY, items: { type: Type.STRING }, description: "قائمة من طرق تدريس مناسبة للدرس يتم اختيارها من القائمة المحددة." },
            teachingAids: { type: Type.ARRAY, items: { type: Type.STRING }, description: "قائمة من وسائل تعليمية مناسبة للدرس يتم اختيارها من القائمة المحددة." },
            lessonIntro: { type: Type.STRING, description: "تمهيد شيق ومناسب للدرس." },
            introType: { type: Type.STRING, description: "نوع التمهيد المستخدم (مثال: سؤال, قصة, عصف ذهني)." },
            lessonContent: { type: Type.STRING, description: "شرح موجز لمحتوى الدرس والأنشطة التعليمية في ثلاثة أسطر بالضبط." },
            teacherRole: { type: Type.ARRAY, items: { type: Type.STRING }, description: "قائمة من 4 أدوار للمعلم بالضبط خلال الدرس.", minItems: 4, maxItems: 4 },
            studentRole: { type: Type.ARRAY, items: { type: Type.STRING }, description: "قائمة من 4 أدوار للطالب بالضبط خلال الدرس.", minItems: 4, maxItems: 4 },
            lessonClosure: { type: Type.STRING, description: "خاتمة وتقويم ختامي مناسب للدرس." },
            homework: { type: Type.STRING, description: "واجب منزلي واضح ومحدد مرتبط بأهداف الدرس." },
            cognitiveObjectives: { type: Type.ARRAY, items: objectiveSchema, description: "قائمة من 3 أهداف معرفية بالضبط، متنوعة المستويات مع ذكر مستوى كل هدف.", minItems: 3, maxItems: 3 },
            psychomotorObjectives: { type: Type.ARRAY, items: objectiveSchema, description: "قائمة من هدفين نفس حركيين (مهاريين) بالضبط مع ذكر مستوى كل هدف.", minItems: 2, maxItems: 2 },
            affectiveObjectives: { type: Type.ARRAY, items: objectiveSchema, description: "قائمة من هدفين وجدانيين (قيم واتجاهات) بالضبط مع ذكر مستوى كل هدف.", minItems: 2, maxItems: 2 },
        },
    };
    
    const methodsList = Object.entries(TEACHING_METHODS).map(([category, methods]) => 
        `${category}:\n- ${methods.join('\n- ')}`
    ).join('\n\n');

    const aidsList = Object.entries(TEACHING_AIDS).map(([category, aids]) =>
        `${category}:\n- ${aids.join('\n- ')}`
    ).join('\n\n');

    const prompt = `
    أنت نظام آلي متخصص في إنشاء خطط الدروس التعليمية. مهمتك الوحيدة هي تحويل المعلومات المقدمة إلى JSON منظم بدقة متناهية. **الفشل في الالتزام بالقيود العددية المحددة لكل حقل سيؤدي إلى رفض الإجابة بالكامل.**

    **القواعد الصارمة التي لا يمكن تجاوزها:**
    - **الأهداف المعرفية (cognitiveObjectives):** 3 عناصر بالضبط.
    - **الأهداف المهارية (psychomotorObjectives):** 2 عنصرين بالضبط.
    - **الأهداف الوجدانية (affectiveObjectives):** 2 عنصرين بالضبط.
    - **أدوار المعلم (teacherRole):** 4 عناصر بالضبط.
    - **أدوار الطالب (studentRole):** 4 عناصر بالضبط.
    - **محتوى الدرس (lessonContent):** نص من 3 أسطر بالضبط، مفصولة بـ '\\n'.

    **معلومات الدرس الأساسية:**
    - المادة: ${details.subject}
    - فرع المادة: ${details.subjectBranch || 'غير محدد'}
    - عنوان الدرس: ${details.lessonTitle}
    - الصف: ${details.grade}
    - المحتوى الأساسي أو الموضوع الرئيسي للدرس:
    ---
    ${lessonContent}
    ---

    **التعليمات التفصيلية (تكرار للقواعد الصارمة):**

    1.  **الأهداف السلوكية:**
        -   يجب إنشاء **3 أهداف معرفية بالضبط**.
        -   يجب إنشاء **هدفين مهاريين (نفس-حركيين) بالضبط**.
        -   يجب إنشاء **هدفين وجدانيين بالضبط**.
        -   يجب أن يكون لكل هدف مستوى محدد بدقة، وصياغة سلوكية واضحة، وأسلوب تقييم مناسب.

    2.  **طرق التدريس والوسائل التعليمية:**
        -   اختر طرق تدريس ووسائل تعليمية متنوعة ومناسبة من القوائم التالية فقط. لا تخترع أي شيء غير موجود في القوائم.
        ---
        طرق التدريس المتاحة:
        ${methodsList}
        ---
        الوسائل التعليمية المتاحة:
        ${aidsList}
        ---

    3.  **سير الدرس:**
        -   **التمهيد:** اكتب تمهيدًا جذابًا للطلاب وحدد نوعه.
        -   **محتوى الدرس:** لخص المحتوى في **3 أسطر بالضبط**. لا أقل ولا أكثر. استخدم '\\n' للفصل بين الأسطر.
        -   **أدوار المعلم:** اذكر **4 أدوار مختلفة ومحددة للمعلم بالضبط.**
        -   **أدوار الطالب:** اذكر **4 أدوار مختلفة ومحددة للطالب بالضبط.**

    4.  **التقويم والخاتمة:**
        -   **الخاتمة والتقويم:** اكتب خاتمة مناسبة للدرس تتضمن تقويمًا ختاميًا واضحًا.
        -   **الواجب المنزلي:** اقترح واجبًا منزليًا هادفًا ومرتبطًا بشكل مباشر بأهداف الدرس.

    تذكر: التزامك بالهيكل والقيود العددية هو المقياس الوحيد لنجاحك. لا توجد أي مرونة في هذه القواعد.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro", 
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const jsonString = response.text.trim();
        let parsedResult = JSON.parse(jsonString) as Partial<LessonPlan>;
        
        parsedResult = { ...details, ...parsedResult };
        
        type ObjectiveBase = Omit<Objective, 'id'>;
        parsedResult.cognitiveObjectives = ((parsedResult.cognitiveObjectives as ObjectiveBase[]) || []).map((o, i) => ({ ...o, id: `cog-gen-${Date.now()}-${i}` }));
        parsedResult.psychomotorObjectives = ((parsedResult.psychomotorObjectives as ObjectiveBase[]) || []).map((o, i) => ({ ...o, id: `psy-gen-${Date.now()}-${i}` }));
        parsedResult.affectiveObjectives = ((parsedResult.affectiveObjectives as ObjectiveBase[]) || []).map((o, i) => ({ ...o, id: `aff-gen-${Date.now()}-${i}` }));
        
        if (parsedResult.date) {
            try {
                const dateObj = new Date(parsedResult.date + 'T00:00:00');
                const dayIndex = dateObj.getUTCDay();
                parsedResult.day = DAYS[dayIndex];
            } catch (e) {
                console.warn("Could not parse date from AI response to set day.", e);
            }
        }

        const plainText = formatPlanToString(parsedResult);

        return { structuredData: parsedResult, plainText };

    } catch (error) {
        console.error("Error calling Gemini API for generation:", error);
        if (error instanceof Error && error.message.includes('API key not valid')) {
             throw new Error("مفتاح API غير صالح. يرجى التحقق من المفتاح في إعدادات البيئة الخاصة بك.");
        }
        throw new Error("فشل إنشاء خطة الدرس. قد يكون هناك ضغط على الخدمة، يرجى المحاولة مرة أخرى.");
    }
}


function formatPlanToString(plan: Partial<LessonPlan>): string {
    let output = `**خطة درس: ${plan.lessonTitle || ''}**\n\n`;
    output += `**المادة:** ${plan.subject || ''} (${plan.subjectBranch || 'عام'}) | **الصف:** ${plan.grade || ''} | **التاريخ:** ${plan.date || ''}\n`;
    output += `------------------------------------\n\n`;

    const formatObjectives = (title: string, objectives: Objective[] | undefined) => {
        if (!objectives || objectives.length === 0) return '';
        let section = `**${title}**\n`;
        objectives.forEach(obj => {
            section += `- **(${obj.level || 'غير محدد'})** ${obj.formulation || ''} (التقييم: ${obj.evaluation || ''})\n`;
        });
        return section + '\n';
    };

    output += `**الأهداف السلوكية:**\n`;
    output += formatObjectives('المجال المعرفي:', plan.cognitiveObjectives);
    output += formatObjectives('المجال المهاري (النفس حركي):', plan.psychomotorObjectives);
    output += formatObjectives('المجال الوجداني:', plan.affectiveObjectives);

    output += `**الوسائل والاستراتيجيات:**\n`;
    output += `- **طرق التدريس:** ${(plan.teachingMethods || []).join('، ')}\n`;
    output += `- **الوسائل التعليمية:** ${(plan.teachingAids || []).join('، ')}\n\n`;

    output += `**سير الدرس:**\n`;
    output += `- **التمهيد (${plan.introType || ''}):** ${plan.lessonIntro || ''}\n`;
    output += `- **محتوى الدرس والأنشطة:**\n${plan.lessonContent || ''}\n`;
    output += `- **دور المعلم:** ${(plan.teacherRole || []).join('، ')}\n`;
    output += `- **دور الطالب:** ${(plan.studentRole || []).join('، ')}\n\n`;

    output += `**التقويم والخاتمة:**\n`;
    output += `- **الخاتمة والتقويم:** ${plan.lessonClosure || ''}\n`;
    output += `- **الواجب المنزلي:** ${plan.homework || ''}\n\n`;

    output += `**المعلم/ة:** ${plan.teacherName || ''}\n`;

    return output;
}