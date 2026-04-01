import Anthropic from '@anthropic-ai/sdk';

export interface ScoutSearchParams {
  service_type: string;
  categories: string[];
  budget_range: string;
  location: string;
  specialities?: string;
}

export interface ScoutResult {
  company_name: string;
  location: string;
  type: string;
  ep_name: string;
  ep_email: string;
  ep_phone: string;
  website: string;
  specialities: string[];
  categories: string[];
}

function mockResults(params: ScoutSearchParams): ScoutResult[] {
  const base = [
    {
      company_name: 'Framestore',
      location: params.location || 'Los Angeles, CA',
      type: params.service_type || 'VFX Studio',
      ep_name: 'Sarah Mitchell',
      ep_email: 'sarah.mitchell@framestore.com',
      ep_phone: '+1 310 555 0101',
      website: 'https://www.framestore.com',
      specialities: ['VFX', 'CGI', 'Motion Capture'],
      categories: params.categories.length > 0 ? params.categories : ['VFX', 'Animation'],
    },
    {
      company_name: 'The Mill',
      location: params.location || 'New York, NY',
      type: params.service_type || 'Post Production',
      ep_name: 'James Hartley',
      ep_email: 'j.hartley@themill.com',
      ep_phone: '+1 212 555 0188',
      website: 'https://www.themill.com',
      specialities: ['Color', 'VFX', 'Motion Graphics'],
      categories: params.categories.length > 0 ? params.categories : ['Color', 'VFX'],
    },
    {
      company_name: 'Company 3',
      location: params.location || 'Los Angeles, CA',
      type: params.service_type || 'Color House',
      ep_name: 'Lisa Park',
      ep_email: 'lpark@company3.com',
      ep_phone: '+1 310 555 0234',
      website: 'https://www.company3.com',
      specialities: ['Color Grading', 'DI', 'HDR'],
      categories: params.categories.length > 0 ? params.categories : ['Color'],
    },
    {
      company_name: 'Deluxe',
      location: params.location || 'Burbank, CA',
      type: params.service_type || 'Post Production',
      ep_name: 'Michael Chen',
      ep_email: 'm.chen@bydeluxe.com',
      ep_phone: '+1 818 555 0312',
      website: 'https://www.bydeluxe.com',
      specialities: ['Sound Mix', 'Color', 'VFX'],
      categories: params.categories.length > 0 ? params.categories : ['Sound', 'Color'],
    },
    {
      company_name: 'Technicolor',
      location: params.location || 'Hollywood, CA',
      type: params.service_type || 'Post Production',
      ep_name: 'Anna Reynolds',
      ep_email: 'a.reynolds@technicolor.com',
      ep_phone: '+1 323 555 0456',
      website: 'https://www.technicolor.com',
      specialities: ['Color', 'VFX', 'Sound'],
      categories: params.categories.length > 0 ? params.categories : ['Color', 'VFX', 'Sound'],
    },
  ];
  return base;
}

export async function searchPartners(params: ScoutSearchParams): Promise<ScoutResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Return mock data when no API key is configured
    return mockResults(params);
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are helping an advertising agency find production partners.
Search the web to find real companies matching these criteria:
- Service type: ${params.service_type}
- Content categories: ${params.categories.join(', ')}
- Budget range: ${params.budget_range}
- Location: ${params.location}
${params.specialities ? '- Specialities: ' + params.specialities : ''}

Find up to 10 real companies. For each return a JSON object with:
company_name, location, type, ep_name, ep_email, ep_phone, website, specialities (array), categories (array).

Return ONLY a JSON array, no other text.`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    // Fall back to mock data if the API call fails
    return mockResults(params);
  }
}
