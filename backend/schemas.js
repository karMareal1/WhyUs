/**
 * JSON schemas for agent-to-agent handoffs
 */

export const CompanyBriefSchema = {
  type: 'object',
  properties: {
    companyName: { type: 'string' },
    mission: { type: 'string' },
    recentNews: { 
      type: 'array',
      items: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          summary: { type: 'string' },
          source: { type: 'string' },
          date: { type: 'string' }
        }
      }
    },
    products: { 
      type: 'array',
      items: { type: 'string' }
    },
    values: {
      type: 'array',
      items: { type: 'string' }
    },
    culture: { type: 'string' },
    sources: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['companyName']
};

export const CandidateBriefSchema = {
  type: 'object',
  properties: {
    relevantExperience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          company: { type: 'string' },
          duration: { type: 'string' },
          achievements: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    },
    skills: {
      type: 'array',
      items: { type: 'string' }
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          degree: { type: 'string' },
          institution: { type: 'string' },
          year: { type: 'string' }
        }
      }
    },
    keyStrengths: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['relevantExperience', 'skills']
};

export const QuestionSpecSchema = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: ['why_company', 'why_role', 'culture_fit', 'why_you', 'mixed']
    },
    expectedLength: {
      type: 'string',
      enum: ['short', 'medium', 'long']
    },
    register: {
      type: 'string',
      enum: ['formal', 'conversational', 'neutral']
    },
    originalQuestion: { type: 'string' }
  },
  required: ['intent', 'expectedLength', 'register', 'originalQuestion']
};

export const DraftSchema = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    wordCount: { type: 'number' },
    citations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fact: { type: 'string' },
          source: { type: 'string' }
        }
      }
    }
  },
  required: ['text', 'wordCount']
};

export const CritiqueSchema = {
  type: 'object',
  properties: {
    approved: { type: 'boolean' },
    genericnessScore: { 
      type: 'number',
      minimum: 0,
      maximum: 10
    },
    factualSupport: {
      type: 'object',
      properties: {
        supported: { type: 'boolean' },
        unsupportedClaims: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    templatedPhrasing: {
      type: 'array',
      items: { type: 'string' }
    },
    rewriteRequest: { type: 'string' },
    finalDraft: { type: 'string' }
  },
  required: ['approved', 'genericnessScore', 'factualSupport']
};
