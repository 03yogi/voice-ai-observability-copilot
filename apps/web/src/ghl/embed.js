/** HighLevel iframe / Custom Menu Link context from URL query params. */
export function parseGhlEmbedContext() {
  const params = new URLSearchParams(window.location.search);
  const locationId =
    params.get('location_id') ||
    params.get('locationId') ||
    params.get('location') ||
    '';
  const companyId = params.get('company_id') || params.get('companyId') || '';
  const userId = params.get('user_id') || params.get('userId') || '';

  let embedded = false;
  try {
    embedded = window.self !== window.top;
  } catch {
    embedded = true;
  }

  return { embedded, locationId, companyId, userId };
}

export const ghlEmbed = parseGhlEmbedContext();
