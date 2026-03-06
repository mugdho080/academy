export enum BudgetCategory {
  CORE = 'Core',
  CAPACITY = 'Capacity Building',
  CAPITAL = 'Capital'
}

export interface BudgetItem {
  id: string;
  category: BudgetCategory;
  name: string;
  allocated: number;
  spent: number;
  remaining: number;
  description: string;
}

export interface Goal {
  id: string;
  text: string;
  type: 'Short-term' | 'Medium-term' | 'Long-term';
}

export interface Invoice {
  id: string;
  date: string;
  provider: string;
  amount: number;
  category: BudgetCategory;
  status: 'Paid' | 'Processing' | 'Pending';
  description: string;
}

export interface NDISPlan {
  participantName: string;
  ndisNumber: string;
  startDate: string;
  endDate: string;
  goals: Goal[];
  budgets: BudgetItem[];
  invoices: Invoice[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
}