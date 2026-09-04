import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import fetch from 'node-fetch';

/**
 * Resume Parser Agent
 * Extract skills, experience, achievements most relevant to company/role from resume.
 * Never invent jobs or metrics.
 */

export class ResumeParserAgent {
  constructor(apiKeys = {}) {
    this.openaiKey = apiKeys.openai;
  }

  /**
   * Main entry point
   * @param {Buffer} resumeBuffer - resume file buffer
   * @param {string} fileType - 'pdf', 'docx', or 'txt'
   * @param {object} companyBrief - context for relevance filtering
   * @param {string} role - optional role title
   * @returns {Promise<CandidateBrief>}
   */
  async parse(resumeBuffer, fileType, companyBrief, role = null) {
    console.log(`[ResumeParserAgent] Parsing resume (${fileType})`);
    
    try {
      // Extract text from resume
      const resumeText = await this.extractText(resumeBuffer, fileType);
      
      // Parse and filter relevant information
      const candidateBrief = await this.extractRelevantInfo(
        resumeText,
        companyBrief,
        role
      );

      console.log(`[ResumeParserAgent] Resume parsed successfully`);
      return candidateBrief;
    } catch (error) {
      console.error(`[ResumeParserAgent] Error parsing resume:`, error);
      return {
        relevantExperience: [],
        skills: [],
        education: [],
        keyStrengths: [],
        error: error.message
      };
    }
  }

  /**
   * Extract text from different file formats
   */
  async extractText(buffer, fileType) {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        const pdfData = await pdfParse(buffer);
        return pdfData.text;
      
      case 'docx':
        const docxData = await mammoth.extractRawText({ buffer });
        return docxData.value;
      
      case 'txt':
      case 'text':
        return buffer.toString('utf-8');
      
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Extract relevant information using LLM
   */
  async extractRelevantInfo(resumeText, companyBrief, role) {
    const prompt = `You are a resume parsing agent. Extract information relevant to this opportunity.

COMPANY CONTEXT:
${JSON.stringify(companyBrief, null, 2)}

${role ? `ROLE: ${role}` : ''}

RESUME TEXT:
${resumeText}

Extract and return ONLY information actually present in the resume, prioritizing relevance to the company/role.

Return this JSON format:
{
  "relevantExperience": [
    {
      "role": "exact job title from resume",
      "company": "company name",
      "duration": "time period",
      "achievements": ["specific achievements with metrics if mentioned"]
    }
  ],
  "skills": ["technical and soft skills mentioned"],
  "education": [
    {
      "degree": "degree name",
      "institution": "school name",
      "year": "graduation year or period"
    }
  ],
  "keyStrengths": ["2-4 key strengths relevant to company/role"]
}

CRITICAL RULES:
1. NEVER invent experience, jobs, or metrics not in the resume
2. Only include what's actually written in the resume
3. Prioritize most relevant items (max 3-4 experiences)
4. Be specific and accurate
5. Return valid JSON only

JSON:`;

    try {
      const response = await this.callLLM(prompt);
      const candidateBrief = JSON.parse(this.extractJSON(response));
      return candidateBrief;
    } catch (error) {
      console.error(`[ResumeParserAgent] LLM extraction error:`, error);
      return {
        relevantExperience: [],
        skills: [],
        education: [],
        keyStrengths: []
      };
    }
  }

  /**
   * Call OpenAI API
   */
  async callLLM(prompt, maxTokens = 1500) {
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
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a resume parsing assistant that extracts only factual information.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.1
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
