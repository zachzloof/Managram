const OpenAI = require('openai');

/**
 * Generate 3 Instagram caption options using GPT-4o
 * @param {string} apiKey - OpenAI API key
 * @param {string} context - Additional context about the post
 * @param {string} style - Caption style: casual, professional, funny, motivational
 * @param {string} mediaType - IMAGE or VIDEO
 * @returns {string[]} Array of 3 caption strings
 */
async function generateCaptions(apiKey, context = '', style = 'casual', mediaType = 'IMAGE') {
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Please add it in Settings.');
  }

  const client = new OpenAI({ apiKey });

  const styleGuides = {
    casual: 'casual, conversational, relatable, and friendly with appropriate emojis',
    professional: 'professional, polished, and brand-appropriate with minimal emojis',
    funny: 'funny, witty, humorous, and entertaining with playful emojis',
    motivational: 'motivational, inspiring, uplifting, and energetic with empowering language',
  };

  const styleGuide = styleGuides[style] || styleGuides.casual;
  const mediaDesc = mediaType === 'VIDEO' ? 'video' : 'photo';

  const prompt = `Generate exactly 3 distinct Instagram captions for a ${mediaDesc} post.
${context ? `Context about the post: ${context}` : ''}
Style: ${styleGuide}

Requirements for each caption:
- Be engaging and authentic
- Include relevant hashtags (5-10 hashtags at the end)
- Vary the length and approach for each option
- Make them feel natural, not spammy
- First caption: shorter and punchy
- Second caption: medium length with storytelling
- Third caption: longer with call-to-action

Return ONLY a JSON array of exactly 3 strings, no other text. Example format:
["Caption one here #hashtag1 #hashtag2", "Caption two here #hashtag1 #hashtag2", "Caption three here #hashtag1 #hashtag2"]`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert Instagram content creator and social media strategist. You write engaging, authentic captions that drive engagement. Always respond with valid JSON arrays.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.8,
    max_tokens: 1000,
  });

  const content = response.choices[0].message.content.trim();

  // Parse the JSON response
  let captions;
  try {
    // Handle potential markdown code blocks
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      captions = JSON.parse(jsonMatch[0]);
    } else {
      captions = JSON.parse(content);
    }
  } catch (err) {
    // If parsing fails, split by newlines and clean up
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 10 && !l.startsWith('[') && !l.startsWith(']'));
    captions = lines.slice(0, 3).map((l) => l.replace(/^["'\d.)-]+\s*/, '').replace(/["']$/, ''));
  }

  if (!Array.isArray(captions) || captions.length === 0) {
    throw new Error('Failed to generate captions. Please try again.');
  }

  // Ensure we have exactly 3 captions
  while (captions.length < 3) {
    captions.push(captions[0]);
  }

  return captions.slice(0, 3);
}

/**
 * Generate a single caption for auto-posting via scheduler
 */
async function generateSingleCaption(apiKey, context = '', style = 'casual') {
  const captions = await generateCaptions(apiKey, context, style, 'IMAGE');
  return captions[0];
}

module.exports = { generateCaptions, generateSingleCaption };
