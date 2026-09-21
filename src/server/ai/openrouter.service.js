import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// The single place that talks to OpenRouter. Every AI feature (resume
// parsing, job analysis, candidate matching) goes through this function —
// the model is always read from OPENROUTER_MODEL (Section 10: never
// hard-code a specific model), and the API key never leaves the server.
export async function callOpenRouter({ systemPrompt, userPrompt, temperature = 0.2 }) {
  if (!env.openRouterApiKey) {
    throw ApiError.internal('OPENROUTER_API_KEY is not configured', 'AI_NOT_CONFIGURED');
  }

  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.openRouterSiteUrl,
        'X-Title': env.openRouterAppName,
      },
      body: JSON.stringify({
        model: env.openRouterModel,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
  } catch (err) {
    throw ApiError.internal(`Failed to reach OpenRouter: ${err.message}`, 'AI_REQUEST_FAILED');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw ApiError.internal(`OpenRouter request failed (${response.status}): ${body}`, 'AI_REQUEST_FAILED');
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;

  if (!content) {
    throw ApiError.internal('OpenRouter returned an empty response', 'AI_EMPTY_RESPONSE');
  }

  try {
    return JSON.parse(content);
  } catch {
    throw ApiError.internal('OpenRouter returned malformed JSON', 'AI_MALFORMED_RESPONSE');
  }
}
