import { Router } from 'express';
import { generateResumeDraft } from '../ai/resume';

// Placeholder AI function – deterministic step machine
export async function generateResumeDraft(currentStep: string, answer: any, state: any) {
  // Define simple step order
  const steps = [
    'welcome',
    'personal_name',
    'contact_details',
    'target_role',
    'skills',
    'experience_check',
    'experience_details',
    'education',
    'certificates',
    'availability',
    'references',
    'summary',
    'preview',
    'final',
  ];
  const idx = steps.indexOf(currentStep);
  const nextIdx = Math.min(idx + 1, steps.length - 1);
  const nextStep = steps[nextIdx];

  // Very naive draft patch – just store answer under step key
  const draftPatch: any = {};
  draftPatch[currentStep] = answer;

  // Simple reply messages
  const replies: { [key: string]: string } = {
    welcome: 'Hi! I am Panda. Let’s start building your resume. What is your full name?',
    personal_name: 'Great! What phone number should be on your resume?',
    contact_details: 'Thanks. What email should be on your resume?',
    target_role: 'What job would you like to apply for?',
    skills: 'What are you good at? (you can list a few skills)',
    experience_check: 'Do you have any work or volunteer experience?',
    experience_details: 'Please describe your most recent experience (role, organisation, dates, duties).',
    education: 'Where did you study or receive training?',
    certificates: 'Do you have any certificates? List them.',
    availability: 'What days can you work?',
    references: 'Would you like to add a reference or write "Available on request"?',
    summary: 'I will now generate a professional summary for you.',
    preview: 'Here is a preview of your resume. You can save or download it.',
    final: 'Your resume is ready! You can save or download as PDF.',
  };

  const reply = replies[currentStep] ?? 'Thanks.';

  // Quick replies placeholder
  const quickReplies: string[] = [];

  return { nextStep: nextStep, draftPatch, reply, quickReplies };
}
