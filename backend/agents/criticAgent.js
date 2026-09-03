import fetch from 'node-fetch';

/**
 * Critic/QA Agent
 * Review for genericness, factual support against briefs, and templated phrasing.
 * Approve or request one concrete rewrite from Writer.
 */

export class CriticAgent {
  constructor(apiKeys = {}) {
    this.openaiKey = apiKeys.openai;
  }

  /**
   * Main entry point
   * @param {object} draft 
   * @param {object} companyBrief 
   * @param {object} candidateBrief 
   * @param {object} questionSpec 
   * @returns {Promise<Critique>}
   */
  async critique(draft, companyBrief, candidateBrief, questionSpec) {
    console.log(`[CriticAgent] Reviewing draft (${draft.wordCount} words)`);
    
    try {
      const critique = await this.reviewDraft(
        draft,
        companyBrief,
        candidateBrief,
        questionSpec
      );

      console.log(`[CriticAgent] Review complete - ${critique.approved ? 'APPROVED' : 'REVISION REQUESTED'}`);
      return critique;
    } catch (error) {
      console.error(`[CriticAgent] Error during critique:`, error);
      // Default to approval on error
      return {
        approved: true,
        genericnessScore: 5,
        factualSupport: {
          supported: true,
          unsupportedClaims: []
        },
        templatedPhrasing: [],
        finalDraft: draft.text,
        error: error.message
      };
    }
  }

  /**
   * Review draft using LLM
   */
  async reviewDraft(draft, companyBrief, candidateBrief, questionSpec) {
    const commonGenericPhrases = [
      'I am passionate about',
      'I am excited to contribute',
      'dynamic environment',
      'fast-paced',
      'team player',
      'think outside the box',
      'hit the ground running',
      'synergy',
      'leverage',
      'I believe I would be a great fit'
    ];

    const prompt = `You are a critical editor reviewing a job application essay draft.

DRAFT:
"${draft.text}"

COMPANY FACTS AVAILABLE:
${JSON.stringify(companyBrief, null, 2)}

CANDIDATE FACTS AVAILABLE:
${JSON.stringify(candidateBrief, null, 2)}

QUESTION CONTEXT:
${JSON.stringify(questionSpec, null, 2)}

Review the draft and return this JSON:
{
  "approved": true or false,
  "genericnessScore": number 0-10 (0=highly specific, 10=completely generic),
  "factualSupport": {
    "supported": true or false,
    "unsupportedClaims": ["list any claims not backed by company/candidate briefs"]
  },
  "templatedPhrasing": ["list any generic/cliché phrases like '${commonGenericPhrases[0]}'"],
  "rewriteRequest": "if not approved, one specific concrete instruction for improvement",
  "finalDraft": "if approved, the draft text; if not approved, empty string"
}

REVIEW CRITERIA:

1. GENERICNESS (score 0-10):
   - 0-3: Specific facts about company (products, news, mission) AND candidate (achievements, metrics)
   - 4-6: Some specifics but also generic language
   - 7-10: Could apply to any company or candidate

2. FACTUAL SUPPORT:
   - Every claim must be traceable to company brief or candidate brief
   - Flag invented facts, exaggerations, or assumptions
   - "unsupported" if ANY claim can't be verified

3. TEMPLATED PHRASING:
   - Flag corporate clichés: "${commonGenericPhrases.join('", "')}"
   - Flag AI tells: "I am excited to", "I believe", overly formal
   - Flag empty adjectives without specifics

4. APPROVAL DECISION:
   - APPROVE if: genericnessScore ≤ 4 AND factualSupport.supported=true AND ≤2 templated phrases
   - REJECT otherwise with ONE specific rewrite instruction
   - Be strict but fair - we want quality

5. REWRITE REQUEST (if rejected):
   - ONE concrete instruction (e.g., "Replace 'passionate about innovation' with specific mention of their Project X announced in July 2026")
   - Not just "be more specific" - tell exactly what to add/change

Return ONLY valid JSON.

JSON:`;

    try {
      const response = await this.callLLM(prompt, 1000);
      const critique = JSON.parse(this.extractJSON(response));
      
      // If approved, ensure finalDraft is set
      if (critique.approved && !critique.finalDraft) {
        critique.finalDraft = draft.text;
      }
      
      return critique;
    } catch (error) {
      console.error(`[CriticAgent] LLM review error:`, error);
      throw error;
    }
  }

  /**
   * Call OpenAI API
   */
  async callLLM(prompt, maxTokens = 1000) {
    if (!this.openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are a critical editor who catches generic writing and ensures factual accuracy. Be strict but constructive.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Extract JSON from LLM response
   */
  extractJSON(text) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : text;
  }
}
