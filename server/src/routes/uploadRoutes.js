import express from 'express';
import { upload } from '../middleware/upload.js';
import { getPrisma } from '../lib/prisma.js';
import { generateBalanceSheet } from '../services/balanceSheet.js';
import { parseTransactionFile } from '../services/parser.js';

const router = express.Router();

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'A file is required.' });
    }

    const transactions = await parseTransactionFile(req.file);
    const balanceSheet = generateBalanceSheet(transactions);
    const prisma = await getPrisma();
    let savedUpload = null;

    if (prisma) {
      try {
        savedUpload = await prisma.upload.create({
          data: {
            filename: req.file.originalname,
            mimeType: req.file.mimetype,
            rowCount: transactions.length,
            transactions: {
              create: transactions.map((transaction) => ({
                date: transaction.date ? new Date(transaction.date) : null,
                description: transaction.description,
                account: transaction.account,
                debit: transaction.debit,
                credit: transaction.credit,
                category: transaction.category,
                confidence: transaction.confidence,
                validationStatus: transaction.validationStatus,
              })),
            },
          },
        });
      } catch (dbError) {
        console.warn('Upload parsed but was not saved to the database:', dbError.message);
      }
    }

    res.status(201).json({
      upload: {
        id: savedUpload?.id || null,
        filename: req.file.originalname,
        rowCount: transactions.length,
      },
      transactions,
      balanceSheet,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
