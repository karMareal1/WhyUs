import { GroqClient } from '../groqClient.js';

/**
 * Critic/QA Agent
 * Review for genericness, factual support against briefs, and templated phrasing.
 * Approve or request one concrete rewrite from Writer.
 */

export class CriticAgent {
  constructor(apiKeys = {}) {
    this.groqClient = new GroqClient(apiKeys.groq);
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
    
    // Validate draft content before review
    if (!draft.text || draft.text.trim().length < 20) {
      throw new Error('Draft text is empty or too short (< 20 characters). Cannot review garbage content.');
    }
    
    const critique = await this.reviewDraft(
      draft,
      companyBrief,
      candidateBrief,
      questionSpec
    );

    console.log(`[CriticAgent] Review complete - ${critique.approved ? 'APPROVED' : 'REVISION REQUESTED'}`);
    return critique;
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

    // Extract minimal context from briefs to save tokens
    const companyContext = {
      name: companyBrief.companyName,
      mission: companyBrief.mission,
      products: companyBrief.products?.slice(0, 3) || [],
      topNews: companyBrief.recentNews?.slice(0, 2).map(n => n.headline || n.title) || []
    };

    const candidateContext = {
      topSkills: candidateBrief.skills?.slice(0, 5) || [],
      topExperience: candidateBrief.relevantExperience?.slice(0, 2).map(exp => 
        `${exp.role || exp.title} at ${exp.company}: ${exp.achievement || exp.description}`
      ) || []
    };

    const prompt = `You are a critical editor reviewing a job application essay draft.

DRAFT:
"${draft.text}"

COMPANY CONTEXT (mission, products, news):
${JSON.stringify(companyContext, null, 2)}

CANDIDATE CONTEXT (skills, top experience):
${JSON.stringify(candidateContext, null, 2)}

QUESTION: "${questionSpec.originalQuestion}"
Intent: ${questionSpec.intent}

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
      const content = await this.groqClient.chat({
        model: 'openai/gpt-oss-20b', // Lighter model for QA to save TPM
        messages: [
          { 
            role: 'system', 
            content: 'You are a critical editor who catches generic writing and ensures factual accuracy. Be strict but constructive.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.3,
        response_format: { type: "json_object" }
      });
      
      const critique = JSON.parse(this.extractJSON(content));
      
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
   * Extract JSON from LLM response
   */
  extractJSON(text) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : text;
  }
}
