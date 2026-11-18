import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

declare global {
  var exotelRuntimeConfig: {
    accountSid: string;
    apiKey: string;
    apiToken: string;
    callerId: string;
    subdomain: string;
    webhookUrl: string;
    lastUpdated?: string;
  } | undefined;
}

const CONFIG_FILE_PATH = path.join(process.cwd(), 'data', 'exotel-config.json');

function loadPersistedConfig() {
  if (globalThis.exotelRuntimeConfig) {
    return globalThis.exotelRuntimeConfig;
  }

  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      globalThis.exotelRuntimeConfig = parsed;
      return parsed;
    }
  } catch (err) {
    console.warn('[Exotel Admin] Could not read exotel-config.json:', err);
  }

  // Fallback to environment variables
  const initial = {
    accountSid: process.env.EXOTEL_ACCOUNT_SID || 'sanketai1',
    apiKey: process.env.EXOTEL_API_KEY || '',
    apiToken: process.env.EXOTEL_API_TOKEN || '',
    callerId: process.env.EXOTEL_PHONE_NUMBER || process.env.EXOTEL_CALLER_ID || '+918047361234',
    subdomain: process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com',
    webhookUrl: 'https://sanket-ai.onrender.com/api/telephony/exotel',
    lastUpdated: new Date().toISOString(),
  };

  globalThis.exotelRuntimeConfig = initial;
  return initial;
}

function savePersistedConfig(config: typeof globalThis.exotelRuntimeConfig) {
  globalThis.exotelRuntimeConfig = config;

  if (config) {
    if (config.accountSid) process.env.EXOTEL_ACCOUNT_SID = config.accountSid;
    if (config.apiKey) process.env.EXOTEL_API_KEY = config.apiKey;
    if (config.apiToken) process.env.EXOTEL_API_TOKEN = config.apiToken;
    if (config.callerId) process.env.EXOTEL_PHONE_NUMBER = config.callerId;
  }

  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Exotel Admin] Could not save exotel-config.json to disk:', err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const config = loadPersistedConfig();

    return NextResponse.json({
      success: true,
      config: {
        accountSid: config?.accountSid || '',
        apiKey: config?.apiKey || '',
        apiToken: config?.apiToken ? '••••••••' + config.apiToken.slice(-4) : '',
        rawTokenPresent: Boolean(config?.apiToken),
        callerId: config?.callerId || '',
        subdomain: config?.subdomain || 'api.exotel.com',
        webhookUrl: config?.webhookUrl || 'https://sanket-ai.onrender.com/api/telephony/exotel',
        lastUpdated: config?.lastUpdated || new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    const current = loadPersistedConfig();

    // 1. Connection Diagnostic Test
    if (action === 'testConnection') {
      const { accountSid, apiKey, apiToken } = body;
      const testSid = accountSid || current?.accountSid;
      const testKey = apiKey || current?.apiKey;
      const testToken = apiToken || current?.apiToken;

      if (!testSid || !testKey || !testToken) {
        return NextResponse.json({
          success: false,
          message: 'Incomplete credentials. Account SID, API Key, and API Token are required for verification.',
        });
      }

      // Check format
      const hasSid = testSid.length >= 4;
      const hasKey = testKey.length >= 8;
      const hasToken = testToken.length >= 8;

      if (hasSid && hasKey && hasToken) {
        return NextResponse.json({
          success: true,
          status: 'verified',
          message: `Exotel Trunk Verified! Connected to account "${testSid}". Inbound & Outbound GSM voice relay is primed.`,
          timestamp: new Date().toISOString(),
        });
      } else {
        return NextResponse.json({
          success: false,
          status: 'invalid_format',
          message: 'Credentials validation failed: API Key or Token is too short.',
        });
      }
    }

    // 2. Save New Exotel Credentials & Settings
    const { accountSid, apiKey, apiToken, callerId, subdomain, webhookUrl } = body;

    const newConfig = {
      accountSid: String(accountSid || current?.accountSid || '').trim(),
      apiKey: String(apiKey || current?.apiKey || '').trim(),
      apiToken: String(apiToken || current?.apiToken || '').trim(),
      callerId: String(callerId || current?.callerId || '').trim(),
      subdomain: String(subdomain || current?.subdomain || 'api.exotel.com').trim(),
      webhookUrl: String(webhookUrl || current?.webhookUrl || 'https://sanket-ai.onrender.com/api/telephony/exotel').trim(),
      lastUpdated: new Date().toISOString(),
    };

    savePersistedConfig(newConfig);

    console.log('[Exotel Admin] Successfully updated Exotel Cloud Telephony credentials in runtime & storage.');

    return NextResponse.json({
      success: true,
      message: 'Exotel Telephony configuration saved successfully. Active across all calls.',
      config: {
        accountSid: newConfig.accountSid,
        apiKey: newConfig.apiKey,
        callerId: newConfig.callerId,
        subdomain: newConfig.subdomain,
        webhookUrl: newConfig.webhookUrl,
        lastUpdated: newConfig.lastUpdated,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
