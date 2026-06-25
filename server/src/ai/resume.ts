import { Type } from '@google/genai';
import { generatePandaStructuredResponse } from './gemini.js';
import { isResumeReady, mergeResumeDraft, normalizeResumeStep } from './builderData.js';

function fallbackResumeDraft(currentStep: string, answer: unknown, state: any) {
  const text = String(answer ?? '');
  const patch: Record<string, unknown> = {};
  const nameMatch = text.match(/\b(?:my name is|i am|i'm)\s+([a-z][a-z\s'-]{1,60})/i);
  const roleMatch = text.match(/\b(?:want|for|as|role is|job is)\s+(?:a|an)?\s*([a-z][a-z\s'-]{2,60})(?:\s+resume|\s+job|\.|$)/i);
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);

  if (nameMatch) patch.personal_name = nameMatch[1].trim();
  if (roleMatch) patch.target_role = roleMatch[1].trim();
  if (emailMatch) patch.contact_email = emailMatch[0].trim();
  if (phoneMatch) patch.contact_phone = phoneMatch[0].trim();

  const step = normalizeResumeStep(currentStep);
  let nextStep = 'personal_details';
  let reply = "Great. I can help with that. What is your name, and what kind of job do you want?";
  let quickReplies = ['Cafe assistant', 'Retail assistant', 'Support worker'];

  if (step === 'welcome' || step === 'personal_details' || step === 'target_role') {
    nextStep = 'skills';
    reply = "Thanks. What are three skills you want on your resume?";
    quickReplies = ['Friendly', 'Reliable', 'Good with people'];
  } else if (step === 'skills') {
    patch.skills = text.split(/,|\n|and/i).map((part) => part.trim()).filter(Boolean);
    nextStep = 'experience';
    reply = "Good. Tell me about any work, volunteering, school, or life experience.";
    quickReplies = ['No paid work yet', 'Volunteering', 'School project'];
  } else if (step === 'experience') {
    patch.experience = [{ role: 'Experience', duties: [text.trim()].filter(Boolean) }];
    nextStep = 'education';
    reply = "Nice. What school, course, or training should we include?";
    quickReplies = ['High school', 'TAFE course', 'First Aid'];
  } else if (step === 'education') {
    patch.education = [{ qualification: text.trim() }];
    nextStep = 'preview';
    patch.summary = 'Friendly and reliable learner ready to build skills and contribute at work.';
    reply = "I have enough to make a simple resume preview. You can save it now, or tell me anything else to add.";
    quickReplies = ['Save it', 'Add certificates', 'Add availability'];
  } else {
    nextStep = 'preview';
    reply = "I added that to your draft. You can save it when it looks right.";
    quickReplies = ['Save it', 'Add more skills', 'Add experience'];
  }

  const draft = mergeResumeDraft(state.draft_resume, patch);
  return {
    success: true,
    nextStep,
    draftPatch: patch,
    reply,
    quickReplies,
    isReady: isResumeReady(draft, nextStep),
  };
}

export async function generateResumeDraft(currentStep: string, answer: any, state: any) {
  const schema = {
    type: Type.OBJECT,
    properties: {
      reply: { type: Type.STRING, description: "Panda's conversational reply to the user's answer." },
      next_question: { type: Type.STRING, description: "The next question Panda should ask, or null if ready." },
      quick_replies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suggested quick reply buttons." },
      current_step: { type: Type.STRING, description: "The internal state machine step (e.g. welcome, personal_details, target_role, skills, experience, education, preview)." },
      draft_patch: {
        type: Type.OBJECT,
        description: "Fields to merge into the draft resume. Use only: personal_name, contact_email, contact_phone, contact_address, target_role, summary, skills, experience, education, certificates, availability, references."
      },
      is_ready_to_preview: { type: Type.BOOLEAN, description: "True if all necessary questions are answered and the resume is ready." }
    },
    required: ["reply", "current_step", "quick_replies", "draft_patch", "is_ready_to_preview"]
  };

  const systemPrompt = `You are Panda, a friendly Academy coach helping a learner build a professional resume.
Ask one simple question at a time. Use short sentences. Offer quick replies. Produce valid JSON only.
IMPORTANT: Improve wording truthfully, but do NOT invent facts, fake jobs, fake certificates, fake experience, or false qualifications.
Privacy: Do not ask for full address, only suburb.
Use this draft shape:
- personal_name: string
- contact_email: string
- contact_phone: string
- contact_address: suburb only
- target_role: string
- summary: short truthful paragraph
- skills: string[]
- experience: { role, organization, dates, duties: string[] }[]
- education: { qualification, institution, year }[]
- certificates: string[]
- availability: string
- references: string
Current step: ${currentStep}.
Current draft: ${JSON.stringify(state.draft_resume)}
Learner's previous answers: ${JSON.stringify(state.answers)}
Learner's latest message: "${answer}"
Output structured JSON containing your reply, the next question, quick replies, the next step name, and any updates to the draft resume.`;

  const res = await generatePandaStructuredResponse({
    systemPrompt,
    userMessage: `Learner says: ${answer}`,
    schema
  });
  
  if (!res.success) {
    if (res.error !== 'AI_NOT_CONFIGURED') {
      return fallbackResumeDraft(currentStep, answer, state);
    }

    return {
      error: res.error,
      message: res.message,
      status: res.status,
      nextStep: currentStep,
      draftPatch: {},
      reply: "Oops, I got a bit confused! Could you tell me that again?",
      quickReplies: [],
      isReady: false
    };
  }

  const response = res.data!;
  return {
    success: true,
    nextStep: response.current_step,
    draftPatch: response.draft_patch,
    reply: response.reply + (response.next_question ? ' ' + response.next_question : ''),
    quickReplies: response.quickReplies,
    isReady: response.is_ready_to_preview
  };
}
