import fetch from 'node-fetch';

/**
 * Shared Groq API client with 429 rate-limit retry logic.
 * 
 * Groq free tier has rate limits (TPM-based). This helper:
 * - Parses retry-after hints from 429 responses
 * - Implements exponential backoff (2s/4s/8s) if no hint
 * - Retries up to 3 times before failing
 */

export class GroqClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.groq.com/openai/v1/chat/completions';
  }

  /**
   * Call Groq chat completions with automatic retry on 429
   * @param {object} params - { model, messages, max_tokens, temperature, response_format? }
   * @param {number} maxRetries - max retry attempts (default 3)
   * @returns {Promise<string>} - message content
   */
  async chat(params, maxRetries = 3) {
    if (!this.apiKey) {
      throw new Error('Groq API key not configured');
    }

    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(this.baseURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: params.model,
            messages: params.messages,
            max_tokens: params.max_tokens || 1000,
            temperature: params.temperature !== undefined ? params.temperature : 0.7,
            ...(params.response_format && { response_format: params.response_format })
          })
        });

        // Success case
        if (response.ok) {
          const data = await response.json();
          const content = data.choices[0]?.message?.content;
          
          if (!content || content.trim() === '') {
            throw new Error('Groq returned empty response');
          }
          
          return content;
        }

        // Rate limit case (429)
        if (response.status === 429) {
          const errorBody = await response.text();
          let waitSeconds = null;

          // Try to parse wait hint from error body
          try {
            const errorJson = JSON.parse(errorBody);
            // Groq may return retry-after hint in error message or headers
            const retryAfterHeader = response.headers.get('retry-after');
            if (retryAfterHeader) {
              waitSeconds = parseInt(retryAfterHeader, 10);
            } else if (errorJson.error?.message) {
              // Parse hints like "try again in 5 seconds" or "wait 30s"
              const match = errorJson.error.message.match(/(\d+)\s*(second|sec|s)/i);
              if (match) {
                waitSeconds = parseInt(match[1], 10);
              }
            }
          } catch (parseError) {
            // Couldn't parse, will use backoff
          }

          // If we have retries left, wait and retry
          if (attempt < maxRetries) {
            const backoffSeconds = waitSeconds || (2 ** (attempt + 1)); // 2s, 4s, 8s
            console.warn(`[GroqClient] Rate limit (429) on attempt ${attempt + 1}/${maxRetries + 1}. Waiting ${backoffSeconds}s before retry...`);
            await this.sleep(backoffSeconds * 1000);
            continue;
          }

          // No retries left, throw
          throw new Error(`Groq rate limit (429) after ${maxRetries + 1} attempts: ${errorBody}`);
        }

        // Other HTTP errors
        const errorBody = await response.text();
        let errorDetail = errorBody;
        try {
          const errorJson = JSON.parse(errorBody);
          errorDetail = errorJson.error?.message || errorBody;
        } catch (e) {
          // Keep raw error text if not JSON
        }
        throw new Error(`Groq API error ${response.status}: ${errorDetail}`);

      } catch (error) {
        lastError = error;
        
        // If it's a network error and we have retries left, retry with backoff
        if (attempt < maxRetries && error.message.includes('fetch')) {
          const backoffSeconds = 2 ** (attempt + 1);
          console.warn(`[GroqClient] Network error on attempt ${attempt + 1}/${maxRetries + 1}. Retrying in ${backoffSeconds}s...`);
          await this.sleep(backoffSeconds * 1000);
          continue;
        }
        
        // Otherwise, throw
        throw error;
      }
    }

    // Should never reach here, but just in case
    throw lastError || new Error('Unknown error in GroqClient.chat');
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
