import multer from 'multer';

const allowedMimeTypes = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
]);

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 25);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadMb * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const lowerName = file.originalname.toLowerCase();
    const hasSupportedExtension = ['.csv', '.xlsx', '.pdf'].some((ext) => lowerName.endsWith(ext));

    if (allowedMimeTypes.has(file.mimetype) || hasSupportedExtension) {
      cb(null, true);
      return;
    }

    cb(new Error('Only CSV, Excel, and PDF files are supported.'));
  },
});
