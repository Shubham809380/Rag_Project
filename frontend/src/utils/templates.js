import { FileText, Lightbulb, HelpCircle, ListChecks, Scale, PenLine } from 'lucide-react';

export const promptTemplates = [
  {
    id: 'custom',
    label: 'Custom Question',
    icon: PenLine,
    prefix: '',
    description: 'Ask anything about your document',
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: FileText,
    prefix: 'Provide a comprehensive summary of this document. Include the main points, key findings, and important details.',
    description: 'Get a full summary of the document',
  },
  {
    id: 'explain',
    label: 'Explain Simply',
    icon: Lightbulb,
    prefix: 'Explain the content of this document in simple, easy-to-understand language. Use everyday words and short sentences.',
    description: 'Simplified explanation of the content',
  },
  {
    id: 'faq',
    label: 'Create FAQ',
    icon: HelpCircle,
    prefix: 'Create a FAQ (Frequently Asked Questions) based on this document. Include at least 8-10 questions and detailed answers.',
    description: 'Generate FAQ from the document',
  },
  {
    id: 'key-points',
    label: 'Key Points',
    icon: ListChecks,
    prefix: 'Extract and list all the key points from this document as bullet points. Organize them by topic or section.',
    description: 'Extract main points as bullet list',
  },
  {
    id: 'compare',
    label: 'Compare & Contrast',
    icon: Scale,
    prefix: 'Analyze this document and identify different viewpoints, methods, or concepts being compared. Present a clear comparison.',
    description: 'Find comparisons in the document',
  },
];
