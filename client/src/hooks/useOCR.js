import { useState, useCallback } from 'react'
import { ocr as ocrApi } from '../api'

/**
 * useOCR — Server-side OCR using PaddleOCR
 *
 * Sends the loading slip photo to the server where PaddleOCR
 * processes it with high accuracy.
 *
 * Extracts: vehicle number, issuing plant (origin), destination,
 *           date, loading slip number, transporter name.
 */
export default function useOCR() {
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [rawText, setRawText] = useState('')
  const [error, setError] = useState(null)

  const processImage = useCallback(async (imageFile) => {
    setProcessing(true)
    setProgress(10)
    setError(null)
    setResult(null)
    setRawText('')

    try {
      setProgress(30)

      // Call server-side PaddleOCR
      const ocrResult = await ocrApi.scanLoadingSlip(imageFile)

      setProgress(90)

      const rawLines = ocrResult.rawLines || []
      setRawText(rawLines.join('\n'))

      const parsed = {
        vehicleNumber: ocrResult.vehicleNumber || null,
        loadingSlipNumber: ocrResult.loadingSlipNumber || null,
        tripDate: ocrResult.tripDate || null,
        originPlant: ocrResult.originPlant || null,
        destinationPlant: ocrResult.destinationPlant || null,
        transporterName: ocrResult.transporterName || null,
        ocrConfidence: ocrResult.ocrConfidence || 0,
      }

      setResult(parsed)
      setProgress(100)
      setProcessing(false)
      return parsed
    } catch (err) {
      console.error('OCR error:', err)
      setError(err.message || 'Could not read the image. Please try again or enter manually.')
      setProcessing(false)
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setProcessing(false)
    setProgress(0)
    setResult(null)
    setRawText('')
    setError(null)
  }, [])

  return { processImage, processing, progress, result, rawText, error, reset }
}
