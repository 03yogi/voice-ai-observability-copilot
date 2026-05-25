/** Allow embedding inside HighLevel sub-account iframes. */
export function embedHeaders(_req, res, next) {
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    [
      "frame-ancestors 'self'",
      'https://app.gohighlevel.com',
      'https://*.gohighlevel.com',
      'https://*.leadconnectorhq.com',
      'http://localhost:*',
      'https://localhost:*',
    ].join(' ')
  );
  next();
}
