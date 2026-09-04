import { ResearchAgent } from './agents/researchAgent.js';
import { ResumeParserAgent } from './agents/resumeParserAgent.js';
import { QuestionClassifierAgent } from './agents/questionClassifierAgent.js';
import { WriterAgent } from './agents/writerAgent.js';
import { CriticAgent } from './agents/criticAgent.js';

/**
 * Orchestrator coordinates all 5 agents
 * Runs Research, Resume Parser, and Question Classifier in parallel
 * Then Writer, then Critic (with optional Writer loop)
 */

export class Orchestrator {
  constructor(apiKeys) {
    this.researchAgent = new ResearchAgent(apiKeys);
    this.resumeParserAgent = new ResumeParserAgent(apiKeys);
    this.questionClassifierAgent = new QuestionClassifierAgent(apiKeys);
    this.writerAgent = new WriterAgent(apiKeys);
    this.criticAgent = new CriticAgent(apiKeys);
    
    // Simple in-memory cache for company research
    this.companyCache = new Map();
  }

  /**
   * Main orchestration method
   * @param {object} request
   * @returns {Promise<object>} final result with draft and critique
   */
  async generate(request) {
    const startTime = Date.now();
    console.log('[Orchestrator] Starting generation pipeline');
    
    const {
      question,
      companyName,
      role,
      resumeBuffer,
      resumeFileType
    } = request;

    try {
      // Phase 1: Run three agents in parallel
      console.log('[Orchestrator] Phase 1: Parallel execution (Research, Resume Parse, Question Classify)');
      
      const [companyBrief, questionSpec] = await Promise.all([
        this.getCachedOrFetchCompanyBrief(companyName, role),
        this.questionClassifierAgent.classify(question)
      ]);

      // Parse resume with company context
      const candidateBrief = await this.resumeParserAgent.parse(
        resumeBuffer,
        resumeFileType,
        companyBrief,
        role
      );

      const phase1Time = Date.now() - startTime;
      console.log(`[Orchestrator] Phase 1 complete (${phase1Time}ms)`);

      // Phase 2: Writer agent
      console.log('[Orchestrator] Phase 2: Writer');
      let draft = await this.writerAgent.write(
        companyBrief,
        candidateBrief,
        questionSpec
      );

      const phase2Time = Date.now() - startTime - phase1Time;
      console.log(`[Orchestrator] Phase 2 complete (${phase2Time}ms)`);

      // Phase 3: Critic agent
      console.log('[Orchestrator] Phase 3: Critic');
      let critique = await this.criticAgent.critique(
        draft,
        companyBrief,
        candidateBrief,
        questionSpec
      );

      // Phase 4: Optional rewrite (max 1 iteration)
      if (!critique.approved && critique.rewriteRequest) {
        console.log('[Orchestrator] Phase 4: Rewrite requested');
        draft = await this.writerAgent.write(
          companyBrief,
          candidateBrief,
          questionSpec,
          critique.rewriteRequest
        );

        // Re-critique
        critique = await this.criticAgent.critique(
          draft,
          companyBrief,
          candidateBrief,
          questionSpec
        );
      }

      const totalTime = Date.now() - startTime;
      console.log(`[Orchestrator] Pipeline complete (${totalTime}ms total)`);

      return {
        success: true,
        draft: critique.approved ? critique.finalDraft : draft.text,
        critique: {
          approved: critique.approved,
          genericnessScore: critique.genericnessScore,
          templatedPhrasing: critique.templatedPhrasing,
          unsupportedClaims: critique.factualSupport.unsupportedClaims || []
        },
        metadata: {
          companyBrief,
          candidateBrief,
          questionSpec,
          wordCount: draft.wordCount,
          citations: draft.citations || [],
          timings: {
            phase1_parallel: phase1Time,
            phase2_writer: phase2Time,
            total: totalTime
          }
        }
      };

    } catch (error) {
      console.error('[Orchestrator] Pipeline error:', error);
      return {
        success: false,
        error: error.message,
        draft: '',
        critique: null
      };
    }
  }

  /**
   * Get cached company brief or fetch new one
   */
  async getCachedOrFetchCompanyBrief(companyName, role) {
    const cacheKey = `${companyName}:${role || 'general'}`;
    
    if (this.companyCache.has(cacheKey)) {
      console.log(`[Orchestrator] Using cached company brief for ${companyName}`);
      return this.companyCache.get(cacheKey);
    }

    const brief = await this.researchAgent.research(companyName, role);
    this.companyCache.set(cacheKey, brief);
    
    // Cache expires after 1 hour
    setTimeout(() => {
      this.companyCache.delete(cacheKey);
    }, 60 * 60 * 1000);

    return brief;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.companyCache.clear();
  }
}
