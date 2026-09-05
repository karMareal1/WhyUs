import fetch from 'node-fetch';

/**
 * Question Classifier Agent
 * Classify exact intent (why_company / why_role / culture_fit / why_you / mixed),
 * expected length, and register.
 */

export class QuestionClassifierAgent {
  constructor(apiKeys = {}) {
    this.groqKey = apiKeys.groq;
  }

  /**
   * Main entry point
   * @param {string} question - the essay question
   * @returns {Promise<QuestionSpec>}
   */
  async classify(question) {
    console.log(`[QuestionClassifierAgent] Classifying question`);
    
    try {
      const questionSpec = await this.analyzeQuestion(question);
      console.log(`[QuestionClassifierAgent] Classification complete: ${questionSpec.intent}`);
      return questionSpec;
    } catch (error) {
      console.error(`[QuestionClassifierAgent] Error classifying:`, error);
      // Return default classification
      return {
        intent: 'mixed',
        expectedLength: 'medium',
        register: 'neutral',
        originalQuestion: question,
        error: error.message
      };
    }
  }

  /**
   * Analyze question using LLM
   */
  async analyzeQuestion(question) {
    const prompt = `You are a question classification agent. Analyze this job application essay question.

QUESTION: "${question}"

Classify and return this JSON format:
{
  "intent": "one of: why_company, why_role, culture_fit, why_you, mixed",
  "expectedLength": "one of: short (50-100 words), medium (100-200 words), long (200+ words)",
  "register": "one of: formal, conversational, neutral",
  "originalQuestion": "${question}"
}

Intent definitions:
- why_company: "Why do you want to work at [Company]?" or "Why [Company]?"
- why_role: "Why are you interested in this role?" or "Why this position?"
- culture_fit: "How do you align with our values?" or "Why are you a good fit?"
- why_you: "What makes you a good candidate?" or "Why should we hire you?"
- mixed: combination of above or unclear

Expected length guidance:
- Look for word limits if specified
- Consider question complexity
- Default to medium if unclear

Register guidance:
- formal: traditional corporate tone expected
- conversational: startup/casual tone
- neutral: standard professional

Return ONLY valid JSON, no additional text.

JSON:`;

    try {
      const response = await this.callLLM(prompt, 500);
      const questionSpec = JSON.parse(this.extractJSON(response));
      return questionSpec;
    } catch (error) {
      console.error(`[QuestionClassifierAgent] LLM classification error:`, error);
      return {
        intent: 'mixed',
        expectedLength: 'medium',
        register: 'neutral',
        originalQuestion: question
      };
    }
  }

  /**
   * Call Groq API
   */
  async callLLM(prompt, maxTokens = 500) {
    if (!this.groqKey) {
      throw new Error('Groq API key not configured');
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.groqKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: 'You are a question classification assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorDetail = errorBody;
      try {
        const errorJson = JSON.parse(errorBody);
        errorDetail = errorJson.error?.message || errorBody;
      } catch (e) {
        // Keep raw error text if not JSON
      }
      throw new Error(`Groq API error ${response.status}: ${errorDetail}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content || content.trim() === '') {
      throw new Error('Groq returned empty response');
    }
    
    return content;
  }

  /**
   * Extract JSON from LLM response
   */
  extractJSON(text) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : text;
  }
}
