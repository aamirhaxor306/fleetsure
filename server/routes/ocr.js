import express from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdtemp, unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Multer: accept single image, max 10MB, store in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files allowed'), false)
    }
  },
})

/**
 * POST /api/ocr/loading-slip
 *
 * Upload a photo of a loading slip → returns structured JSON.
 * Uses PaddleOCR (Python) on the server for high accuracy.
 */
router.post(
  '/loading-slip',
  requireAuth,
  upload.single('image'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    let tempDir = null
    let inputPath = null
    let processedPath = null

    try {
      // Create temp directory
      tempDir = await mkdtemp(join(tmpdir(), 'fleetsure-ocr-'))
      inputPath = join(tempDir, 'input.jpg')
      processedPath = join(tempDir, 'processed.jpg')

      // Preprocess image with sharp: grayscale, normalize, sharpen for better OCR
      await sharp(req.file.buffer)
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1.5 })
        .jpeg({ quality: 95 })
        .toFile(processedPath)

      // Run PaddleOCR Python script
      const pythonScript = join(__dirname, '..', 'ocr', 'process_loading_slip.py')
      const result = await runPythonOCR(pythonScript, processedPath)

      res.json(result)
    } catch (err) {
      console.error('[OCR] Error:', err.message)
      res.status(500).json({ error: err.message || 'OCR processing failed' })
    } finally {
      // Clean up temp files
      try {
        if (inputPath) await unlink(inputPath).catch(() => {})
        if (processedPath) await unlink(processedPath).catch(() => {})
        if (tempDir) {
          const { rmdir } = await import('fs/promises')
          await rmdir(tempDir).catch(() => {})
        }
      } catch {}
    }
  }
)

/**
 * Run the Python OCR script as a child process.
 * Returns parsed JSON from stdout.
 */
function runPythonOCR(scriptPath, imagePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [scriptPath, imagePath], {
      env: {
        ...process.env,
        PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True',
      },
      timeout: 60000, // 60 second timeout
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('[OCR] Python stderr:', stderr)
        try {
          const errResult = JSON.parse(stdout)
          reject(new Error(errResult.error || 'OCR script failed'))
        } catch {
          reject(new Error(`OCR script exited with code ${code}`))
        }
        return
      }

      try {
        const result = JSON.parse(stdout)
        if (result.error) {
          reject(new Error(result.error))
        } else {
          resolve(result)
        }
      } catch (e) {
        reject(new Error('Failed to parse OCR output'))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to start Python: ${err.message}`))
    })
  })
}

export default router
