import { google } from 'googleapis';
import crypto from 'crypto';
import prisma from '../lib/prisma';

const ENCRYPTION_KEY = (process.env.JWT_SECRET ?? 'changeme_replace_with_32_byte_hex_in_production').slice(0, 32).padEnd(32, '0');
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
}

export async function handleCallback(code: string, userId: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error('No refresh token received');
  }

  await prisma.googleToken.upsert({
    where: { user_id: userId },
    update: {
      encrypted_refresh: encrypt(tokens.refresh_token),
      access_token: tokens.access_token ?? null,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
    create: {
      user_id: userId,
      encrypted_refresh: encrypt(tokens.refresh_token),
      access_token: tokens.access_token ?? null,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });
}

async function getAuthenticatedClient(userId: string) {
  const tokenRecord = await prisma.googleToken.findUnique({
    where: { user_id: userId },
  });

  if (!tokenRecord) {
    throw new Error('Google account not connected. Please authenticate first.');
  }

  const client = getOAuth2Client();
  const refreshToken = decrypt(tokenRecord.encrypted_refresh);
  client.setCredentials({
    refresh_token: refreshToken,
    access_token: tokenRecord.access_token ?? undefined,
  });

  return client;
}

export async function isConnected(userId: string): Promise<boolean> {
  const token = await prisma.googleToken.findUnique({
    where: { user_id: userId },
  });
  return !!token;
}

export interface BudgetExportData {
  clientName: string;
  projectName: string;
  lineItems: { label: string; amount_cents: number; is_agency_fee: boolean }[];
}

export async function exportBudgetToSheets(userId: string, data: BudgetExportData): Promise<string> {
  const auth = await getAuthenticatedClient(userId);
  const sheets = google.sheets({ version: 'v4', auth });

  const total = data.lineItems.reduce((s, i) => s + i.amount_cents, 0);

  const rows: (string | number)[][] = [
    ['Item', 'Amount', '% of Total'],
    ...data.lineItems.map((item) => [
      item.label + (item.is_agency_fee ? ' (Agency Fee)' : ''),
      item.amount_cents / 100,
      total > 0 ? Number(((item.amount_cents / total) * 100).toFixed(1)) : 0,
    ]),
    [],
    ['Total', total / 100, '100%'],
  ];

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `${data.clientName} — ${data.projectName} Budget` },
      sheets: [
        {
          properties: { title: 'Budget' },
          data: [{ startRow: 0, startColumn: 0, rowData: rows.map((row) => ({
            values: row.map((cell) => ({
              userEnteredValue: typeof cell === 'number'
                ? { numberValue: cell }
                : { stringValue: String(cell) },
            })),
          })) }],
        },
      ],
    },
  });

  return spreadsheet.data.spreadsheetUrl ?? spreadsheet.data.spreadsheetId ?? '';
}

export interface ScheduleExportData {
  clientName: string;
  projectName: string;
  milestones: {
    name: string;
    assignee: string;
    start_date: string | null;
    end_date: string | null;
    completed: boolean;
  }[];
}

export async function exportScheduleToSheets(userId: string, data: ScheduleExportData): Promise<string> {
  const auth = await getAuthenticatedClient(userId);
  const sheets = google.sheets({ version: 'v4', auth });

  const rows: (string | boolean)[][] = [
    ['Milestone', 'Assignee', 'Start Date', 'End Date', 'Completed'],
    ...data.milestones.map((m) => [
      m.name,
      m.assignee,
      m.start_date ?? '',
      m.end_date ?? '',
      m.completed ? 'Yes' : 'No',
    ]),
  ];

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `${data.clientName} — ${data.projectName} Schedule` },
      sheets: [
        {
          properties: { title: 'Schedule' },
          data: [{ startRow: 0, startColumn: 0, rowData: rows.map((row) => ({
            values: row.map((cell) => ({
              userEnteredValue: typeof cell === 'boolean'
                ? { boolValue: cell }
                : { stringValue: String(cell) },
            })),
          })) }],
        },
      ],
    },
  });

  return spreadsheet.data.spreadsheetUrl ?? spreadsheet.data.spreadsheetId ?? '';
}

export async function saveToDrive(userId: string, fileId: string, folderId: string): Promise<void> {
  const auth = await getAuthenticatedClient(userId);
  const drive = google.drive({ version: 'v3', auth });

  await drive.files.update({
    fileId,
    addParents: folderId,
    fields: 'id, parents',
  });
}
