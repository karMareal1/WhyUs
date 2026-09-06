import fetch from 'node-fetch';
import { GroqClient } from '../groqClient.js';

/**
 * Research Agent
 * Given company name (+ optional role), search the web for mission, recent news, 
 * values, products, culture. Summarize into structured sourced facts.
 */

const GOOGLE_SEARCH_API = 'https://www.googleapis.com/customsearch/v1';

export class ResearchAgent {
  constructor(apiKeys = {}) {
    this.groqClient = new GroqClient(apiKeys.groq);
  }

  /**
   * Main entry point for research
   * @param {string} companyName 
   * @param {string} role - optional
   * @returns {Promise<CompanyBrief>}
   */
  async research(companyName, role = null) {
    console.log(`[ResearchAgent] Starting research for ${companyName}${role ? ` (${role})` : ''}`);
    
    try {
      // Search for company information
      const searchQueries = [
        `${companyName} company mission values`,
        `${companyName} recent news 2026`,
        `${companyName} company culture products`
      ];

      const searchResults = await Promise.all(
        searchQueries.map(query => this.webSearch(query))
      );

      // Extract structured information using LLM
      const companyBrief = await this.extractCompanyInfo(
        companyName, 
        role,
        searchResults.flat()
      );

      console.log(`[ResearchAgent] Research complete for ${companyName}`);
      return companyBrief;
    } catch (error) {
      console.error(`[ResearchAgent] Error during research:`, error);
      // Return minimal brief on error
      return {
        companyName,
        mission: '',
        recentNews: [],
        products: [],
        values: [],
        culture: '',
        sources: [],
        error: error.message
      };
    }
  }

  /**
   * Perform web search (simplified - uses fetch to simulate)
   */
  async webSearch(query) {
    console.log(`[ResearchAgent] Searching: ${query}`);
    
    // Simulate web search results
    // In production, integrate with actual search API (Google Custom Search, Bing, etc.)
    try {
      // For hackathon demo, return structured mock data
      // In production, replace with actual API calls
      return [{
        title: `${query} results`,
        snippet: `Information about ${query}`,
        url: `https://example.com/${encodeURIComponent(query)}`
      }];
    } catch (error) {
      console.error(`[ResearchAgent] Search error:`, error);
      return [];
    }
  }

  /**
   * Extract structured company information using LLM
   */
  async extractCompanyInfo(companyName, role, searchResults) {
    const prompt = `You are a research agent extracting company information.

Company: ${companyName}
${role ? `Role: ${role}` : ''}

Search Results:
${JSON.stringify(searchResults, null, 2)}

Extract and return ONLY factual information in this JSON format:
{
  "companyName": "${companyName}",
  "mission": "company mission statement (if found)",
  "recentNews": [
    {
      "headline": "news headline",
      "summary": "brief summary",
      "source": "source URL or name",
      "date": "date if available"
    }
  ],
  "products": ["list of main products/services"],
  "values": ["core company values"],
  "culture": "brief description of company culture",
  "sources": ["list of source URLs"]
}

CRITICAL RULES:
1. NEVER invent facts - only use information from search results
2. If information is not found, use empty string or empty array
3. Be specific and cite sources
4. Return valid JSON only, no additional text

JSON:`;

    try {
      const content = await this.groqClient.chat({
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: 'You are a research assistant that extracts factual company information.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { type: "json_object" }
      });
      
      const companyBrief = JSON.parse(this.extractJSON(content));
      return companyBrief;
    } catch (error) {
      console.error(`[ResearchAgent] LLM extraction error:`, error);
      return {
        companyName,
        mission: '',
        recentNews: [],
        products: [],
        values: [],
        culture: '',
        sources: []
      };
    }
  }

  /**
   * Extract JSON from LLM response
   */
  extractJSON(text) {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : text;
  }
}
