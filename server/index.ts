import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[Yarnna Server] Running on http://localhost:${PORT}`);
  console.log(`[Yarnna Server] Testnet Phase Active. Video endpoints disabled.`);
});
