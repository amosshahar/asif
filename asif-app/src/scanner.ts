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
  if (!granted) return null

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
