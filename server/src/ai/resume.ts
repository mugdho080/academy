import { Type } from '@google/genai';
import { generatePandaStructuredResponse } from './gemini.js';

export async function generateResumeDraft(currentStep: string, answer: any, state: any) {
  const schema = {
    type: Type.OBJECT,
    properties: {
      reply: { type: Type.STRING, description: "Panda's conversational reply to the user's answer." },
      next_question: { type: Type.STRING, description: "The next question Panda should ask, or null if ready." },
      quick_replies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suggested quick reply buttons." },
      current_step: { type: Type.STRING, description: "The internal state machine step (e.g. welcome, personal_details, target_role, skills, experience, education, preview)." },
      draft_patch: { type: Type.OBJECT, description: "Any new fields to merge into the draft resume." },
      is_ready_to_preview: { type: Type.BOOLEAN, description: "True if all necessary questions are answered and the resume is ready." }
    },
    required: ["reply", "current_step", "quick_replies", "draft_patch", "is_ready_to_preview"]
  };

  const systemPrompt = `You are Panda, a friendly Academy coach helping a learner build a professional resume.
Ask one simple question at a time. Use short sentences. Offer quick replies. Produce valid JSON only.
IMPORTANT: Improve wording truthfully, but do NOT invent facts, fake jobs, fake certificates, fake experience, or false qualifications.
Privacy: Do not ask for full address, only suburb.
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
