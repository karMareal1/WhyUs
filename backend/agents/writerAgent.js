import fetch from 'node-fetch';

/**
 * Writer Agent
 * Consume CompanyBrief + CandidateBrief + QuestionSpec and write one natural
 * first-person paragraph. No AI tells, no generic boilerplate, no invented facts.
 */

export class WriterAgent {
  constructor(apiKeys = {}) {
    this.groqKey = apiKeys.groq;
  }

  /**
   * Main entry point
   * @param {object} companyBrief 
   * @param {object} candidateBrief 
   * @param {object} questionSpec 
   * @returns {Promise<Draft>}
   */
  async write(companyBrief, candidateBrief, questionSpec, rewriteRequest = null) {
    console.log(`[WriterAgent] Writing draft for ${questionSpec.intent} question`);
    
    const draft = await this.generateDraft(
      companyBrief,
      candidateBrief,
      questionSpec,
      rewriteRequest
    );

    console.log(`[WriterAgent] Draft complete (${draft.wordCount} words)`);
    return draft;
  }

  /**
   * Generate draft using LLM
   */
  async generateDraft(companyBrief, candidateBrief, questionSpec, rewriteRequest) {
    const lengthGuidance = {
      short: '50-100 words',
      medium: '100-200 words',
      long: '200-300 words'
    };

    const prompt = `You are a professional writer helping with a job application essay.

COMPANY INFORMATION:
${JSON.stringify(companyBrief, null, 2)}

CANDIDATE BACKGROUND:
${JSON.stringify(candidateBrief, null, 2)}

QUESTION: "${questionSpec.originalQuestion}"
Intent: ${questionSpec.intent}
Expected length: ${lengthGuidance[questionSpec.expectedLength]}
Tone: ${questionSpec.register}

${rewriteRequest ? `REVISION REQUEST: ${rewriteRequest}` : ''}

Write a compelling, specific answer in first person.

CRITICAL WRITING RULES:
1. Write in natural first person (I, my, me)
2. Be SPECIFIC - use actual company facts (products, mission, news, values)
3. Be SPECIFIC - use actual candidate achievements with metrics
4. NO generic phrases like "I'm passionate about", "excited to contribute", "dynamic environment"
5. NO AI tells - write like a human would naturally speak
6. If company info is thin, write shorter and be honest - don't pad with fluff
7. Connect your real experience to company's real needs/values/products
8. Use conversational, confident tone - not corporate jargon
9. Show genuine alignment through concrete examples
10. NEVER invent facts not in the briefs

Target ${lengthGuidance[questionSpec.expectedLength]}.

Return ONLY the essay paragraph text. No JSON. No markdown code fences. No extra formatting.`;

    try {
      const content = await this.callLLM(prompt, 2000);
      const text = content.trim();
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      
      const draft = {
        text: text,
        wordCount: wordCount,
        citations: []
      };
      
      return draft;
    } catch (error) {
      console.error(`[WriterAgent] LLM generation error:`, error);
      throw error;
    }
  }

  /**
   * Call Groq API with higher quality model for writing
   */
  async callLLM(prompt, maxTokens = 2000) {
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
        model: 'openai/gpt-oss-120b',
        messages: [
          { 
            role: 'system', 
            content: 'You are a skilled writer who creates specific, human-sounding content grounded in facts. Never write generic corporate fluff. Return only plain text paragraphs, no JSON, no markdown.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
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
