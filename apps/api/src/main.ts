import app from './app';

const PORT = parseInt(process.env.PORT ?? '3333', 10);

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});