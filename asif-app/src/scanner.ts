import {
  BarcodeScanner,
  BarcodeFormat,
} from '@capacitor-mlkit/barcode-scanning'

export async function requestCameraPermission(): Promise<boolean> {
  const { camera } = await BarcodeScanner.requestPermissions()
  return camera === 'granted' || camera === 'limited'
}

export async function scanBarcode(): Promise<string | null> {
  const granted = await requestCameraPermission()
  if (!granted) {
    const err = new Error('CAMERA_PERMISSION_DENIED')
    ;(err as Error & { code?: string }).code = 'CAMERA_PERMISSION_DENIED'
    throw err
  }

  const { barcodes } = await BarcodeScanner.scan({
    formats: [
      BarcodeFormat.Ean13,
      BarcodeFormat.Ean8,
      BarcodeFormat.Code128,
      BarcodeFormat.Code39,
      BarcodeFormat.QrCode,
    ],
  })

  return barcodes.length > 0 ? (barcodes[0].rawValue ?? null) : null
}
