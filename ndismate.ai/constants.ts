import { NDISPlan, BudgetCategory } from './types';

export const MOCK_PLAN: NDISPlan = {
  participantName: "Alex Smith",
  ndisNumber: "430 123 456",
  startDate: "2024-01-01",
  endDate: "2025-01-01",
  goals: [
    { id: 'g1', type: 'Short-term', text: 'Improve daily living independence by learning to cook healthy meals.' },
    { id: 'g2', type: 'Medium-term', text: 'Increase community participation by joining a local art group.' },
    { id: 'g3', type: 'Long-term', text: 'Find and maintain part-time employment in the retail sector.' }
  ],
  budgets: [
    {
      id: 'b1',
      category: BudgetCategory.CORE,
      name: 'Assistance with Daily Life',
      allocated: 45000,
      spent: 12500,
      remaining: 32500,
      description: 'Funding for daily personal activities and household tasks.'
    },
    {
      id: 'b2',
      category: BudgetCategory.CORE,
      name: 'Consumables',
      allocated: 3500,
      spent: 3200,
      remaining: 300,
      description: 'Everyday items like continence aids or low-cost assistive technology.'
    },
    {
      id: 'b3',
      category: BudgetCategory.CAPACITY,
      name: 'Improved Daily Living Skills',
      allocated: 12000,
      spent: 4000,
      remaining: 8000,
      description: 'Assessment, training or therapy to help increase your skills.'
    },
    {
      id: 'b4',
      category: BudgetCategory.CAPACITY,
      name: 'Support Coordination',
      allocated: 6000,
      spent: 1500,
      remaining: 4500,
      description: 'Help to understand and use your plan.'
    },
    {
      id: 'b5',
      category: BudgetCategory.CAPITAL,
      name: 'Assistive Technology',
      allocated: 5000,
      spent: 0,
      remaining: 5000,
      description: 'Equipment/Technology to help you with tasks.'
    }
  ],
  invoices: [
    { id: 'i1', date: '2024-05-12', provider: 'Sunny Days Therapy', amount: 193.99, category: BudgetCategory.CAPACITY, status: 'Paid', description: 'Occupational Therapy Session' },
    { id: 'i2', date: '2024-05-10', provider: 'Clean Home Services', amount: 120.00, category: BudgetCategory.CORE, status: 'Paid', description: 'House cleaning (2 hours)' },
    { id: 'i3', date: '2024-05-01', provider: 'Wheelchair Whiz', amount: 3200.00, category: BudgetCategory.CORE, status: 'Paid', description: 'Consumables - Continence' },
    { id: 'i4', date: '2024-04-28', provider: 'Support Co Plus', amount: 100.14, category: BudgetCategory.CAPACITY, status: 'Processing', description: 'Level 2 Coordination' }
  ]
};

export const GET_SYSTEM_INSTRUCTION = (plan: NDISPlan | null) => `You are "Matey", a friendly, warm, and professional AI Support Coordinator for the NDIS (National Disability Insurance Scheme) in Australia.
Your goal is to help participants understand their plan, budgets, and goals.
Tone: Calm, clear, encouraging, non-clinical. Use short sentences. Never be patronizing.
Key Domain Knowledge:
- Core Support: Flexible funding for daily activities, consumables, social participation, and transport.
- Capacity Building: Funding to build independence and skills (e.g., therapy, employment help). Cannot be used for Core items usually.
- Capital: Funding for expensive assistive technology or home mods. Very strict.
- You cannot see the user's "myplace" portal directly. You only know what they share.
- Always provide "plan-grounded guidance". Do not give legal or financial guarantees.
- If asked "Can I buy X?", check if it relates to their goals and budget category rules. Suggest they keep receipts and evidence.

${plan ? `Current Plan Context:
Participant: ${plan.participantName}
Ends: ${plan.endDate}
Goals: ${plan.goals.map(g => g.text).join('; ')}
Budgets Overview:
${plan.budgets.map(b => `- ${b.name} (${b.category}): $${b.remaining} remaining of $${b.allocated}`).join('\n')}
` : 'No plan is currently loaded. Ask the user to upload their NDIS plan PDF to get started.'}
`;
