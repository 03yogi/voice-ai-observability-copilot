/** Normalize GHL call log fields for SQLite storage. */
export function normalizeExtractedData(log) {
  const raw = log?.extractedData ?? log?.extracted_data ?? log?.extracted ?? null;
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

export function normalizeCallLog(log) {
  const transcript =
    log?.transcript ??
    log?.transcriptText ??
    (Array.isArray(log?.transcriptWithToolCalls)
      ? log.transcriptWithToolCalls.map((t) => t.message || t.text || '').filter(Boolean).join('\n')
      : '') ??
    '';

  return {
    id: log.id,
    contactId: log.contactId ?? log.contact_id ?? null,
    createdAt: log.createdAt ?? log.created_at ?? null,
    duration: log.duration ?? log.durationSec ?? 0,
    summary: log.summary ?? '',
    transcript: typeof transcript === 'string' ? transcript : '',
    transcriptWithToolCalls: log.transcriptWithToolCalls ?? log.transcript_with_tool_calls ?? [],
    extractedData: normalizeExtractedData(log),
    trialCall: Boolean(log.trialCall ?? log.trial_call),
  };
}
