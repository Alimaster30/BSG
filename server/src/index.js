import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import balanceSheetRoutes from './routes/balanceSheetRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const frontendOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
  : true;

app.use(cors({ origin: frontendOrigins }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '75mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'smart-balance-sheet-api' });
});

app.use('/api/uploads', uploadRoutes);
app.use('/api/balance-sheet', balanceSheetRoutes);
app.use('/api/reports', reportRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: `File is too large. Maximum upload size is ${process.env.MAX_UPLOAD_MB || 25} MB.`,
    });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Unexpected server error.',
  });
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Smart Balance Sheet API running on port ${port}`);
  });
}

export default app;
