/**
 * Default KPI categories and feedback questions used when initializing appraisal data.
 * Adjust contents to match your Prisma schema and desired default objectives/questions.
 */
export const DEFAULT_FEEDBACK_QUESTIONS = [
  { question: 'How would you rate your emotional stability at work?', order: 1 },

  { question: 'What aspects of your work are you most satisfied with?', order: 2 },

  { question: 'What challenges are you facing in your role?', order: 3 },

  {
    question:
      'Are there any job related factors that are affecting your emotional well-being?',
    order: 4,
  },

  { question: 'What can management do to support?', order: 5 },

  { question: 'Any recommendations for improving the work enviroment?', order: 6 },

  {
    question:
      'Are there any company policies or practicies that could be improved to better support work-life-balance?',
    order: 7,
  },
];
