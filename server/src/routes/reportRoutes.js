import express from 'express';
import { createExcelReport, createPdfReport } from '../services/reportExporter.js';

const router = express.Router();

function getTransactions(req, res) {
  const transactions = Array.isArray(req.body.transactions) ? req.body.transactions : [];
  if (!transactions.length) {
    res.status(400).json({ message: 'Transactions are required before exporting.' });
    return null;
  }
  return transactions;
}

router.post('/pdf', async (req, res, next) => {
  try {
    const transactions = getTransactions(req, res);
    if (!transactions) return;

    const buffer = await createPdfReport(transactions, req.body.balanceSheet);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="balance-sheet-report.pdf"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.post('/excel', async (req, res, next) => {
  try {
    const transactions = getTransactions(req, res);
    if (!transactions) return;

    const buffer = await createExcelReport(transactions, req.body.balanceSheet);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="balance-sheet-report.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

export default router;
