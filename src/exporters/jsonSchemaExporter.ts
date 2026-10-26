import { isRecord, normalizeDocument, type PdfDocumentSchema } from '@/types/editor'

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocumentParseError'
  }
}

export interface JsonExportOptions {
  /** Pretty printed by default: the JSON is also meant to be human-reviewable. */
  pretty?: boolean
}

/**
 * Serialises a document for persistence. The output always contains the full
 * normalised schema, so the backend never has to guess missing geometry.
 */
export function exportDocumentJson(document: unknown, options: JsonExportOptions = {}): string {
  const normalized = normalizeDocument(document)
  return JSON.stringify(normalized, null, options.pretty === false ? undefined : 2)
}

export function isValidDocument(value: unknown): value is PdfDocumentSchema {
  if (!isRecord(value)) return false
  if (!Array.isArray(value.pages) || value.pages.length === 0) return false
  return value.pages.every(
    (page) => isRecord(page) && Array.isArray(page.elements) && typeof page.id === 'string',
  )
}

/**
 * Parses a stored template. Invalid JSON and non-document payloads raise a
 * `DocumentParseError` with a message that can be shown to an operator.
 */
export function parseDocumentJson(text: string): PdfDocumentSchema {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new DocumentParseError(`Invalid JSON: ${(error as Error).message}`)
  }

  if (!isRecord(parsed)) {
    throw new DocumentParseError('Invalid document: expected a document object')
  }
  if (!Array.isArray(parsed.pages)) {
    throw new DocumentParseError('Invalid document: pages must be an array')
  }

  return normalizeDocument(parsed)
}

/** Convenience wrapper for `<input type="file">` based template import. */
export async function parseDocumentFile(file: File): Promise<PdfDocumentSchema> {
  return parseDocumentJson(await file.text())
}
