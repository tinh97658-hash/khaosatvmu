import type { CellValue } from 'read-excel-file/browser';
import type { ImportAdminUserRow } from '../types';

const maximumFileSize = 5 * 1024 * 1024;
const maximumRows = 500;
const emailHeaders = new Set(['email', 'email tai khoan google', 'gmail']);
const displayNameHeaders = new Set(['ho va ten', 'ten hien thi', 'display name', 'name']);

export type UserImportFileErrorCode =
  | 'FILE_TYPE'
  | 'FILE_SIZE'
  | 'FILE_EMPTY'
  | 'EMAIL_HEADER_MISSING'
  | 'NO_DATA_ROWS'
  | 'TOO_MANY_ROWS'
  | 'READ_FAILED';

export class UserImportFileError extends Error {
  public readonly code: UserImportFileErrorCode;

  constructor(code: UserImportFileErrorCode) {
    super(code);
    this.code = code;
  }
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cellText(value: CellValue | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

export async function parseUserImportFile(file: File): Promise<ImportAdminUserRow[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new UserImportFileError('FILE_TYPE');
  }
  if (file.size > maximumFileSize) {
    throw new UserImportFileError('FILE_SIZE');
  }

  let sheet;
  try {
    const { readSheet } = await import('read-excel-file/browser');
    sheet = await readSheet(file);
  } catch {
    throw new UserImportFileError('READ_FAILED');
  }

  if (sheet.length === 0) {
    throw new UserImportFileError('FILE_EMPTY');
  }

  const headers = sheet[0].map((value) => normalizeHeader(cellText(value)));
  const emailIndex = headers.findIndex((header) => emailHeaders.has(header));
  if (emailIndex < 0) {
    throw new UserImportFileError('EMAIL_HEADER_MISSING');
  }
  const displayNameIndex = headers.findIndex((header) => displayNameHeaders.has(header));

  const users = sheet.slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      email: cellText(row[emailIndex]),
      displayName: displayNameIndex < 0 ? '' : cellText(row[displayNameIndex]),
    }))
    .filter((row) => row.email.length > 0 || row.displayName.length > 0);

  if (users.length === 0) {
    throw new UserImportFileError('NO_DATA_ROWS');
  }
  if (users.length > maximumRows) {
    throw new UserImportFileError('TOO_MANY_ROWS');
  }

  return users;
}
