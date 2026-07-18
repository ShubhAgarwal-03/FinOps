'use client';

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <div style={{ padding: 24 }}>
      <h2>Something broke</h2>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
        {error.message}
        {'\n'}
        {error.stack}
      </pre>
    </div>
  );
}