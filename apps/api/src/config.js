import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const llmProvider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
const isProd = process.env.NODE_ENV === 'production';
const webDistPath = path.resolve(__dirname, '../../web/dist');

export const config = {
  port: Number(process.env.PORT || 3001),
  isProd,
  serveWeb: isProd || process.env.SERVE_WEB === 'true',
  webDistPath,
  publicUrl: (process.env.APP_URL || '').replace(/\/$/, ''),
  ghl: {
    apiToken: process.env.GHL_API_TOKEN || '',
    locationId: process.env.GHL_LOCATION_ID || '',
    agentId: process.env.GHL_AGENT_ID || '',
    apiBase: process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com',
    timezone: process.env.GHL_TIMEZONE || 'Asia/Kolkata',
  },
  llm: {
    provider: llmProvider,
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    },
  },
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../../data/copilot.db'),
};

export function getActiveLlmProvider() {
  return config.llm.provider === 'gemini' ? 'gemini' : 'openai';
}
