import express from 'express';
import { generateBalanceSheet } from '../services/balanceSheet.js';

const router = express.Router();

router.post('/', (req, res) => {
  const transactions = Array.isArray(req.body.transactions) ? req.body.transactions : [];
  res.json({ balanceSheet: generateBalanceSheet(transactions) });
});

export default router;
