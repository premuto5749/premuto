/**
 * 이미지 압축 유틸리티
 * Vercel 서버리스 함수의 4.5MB 페이로드 제한을 피하기 위해
 * 클라이언트에서 이미지를 압축합니다.
 */

const MAX_WIDTH = 1920
const MAX_HEIGHT = 1920
const JPEG_QUALITY = 0.8
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB 목표

/**
 * 이미지 파일을 압축합니다.
 * @param file 원본 이미지 파일
 * @returns 압축된 이미지 파일
 */
export async function compressImage(file: File): Promise<File> {
  // 이미 작은 파일은 압축하지 않음
  if (file.size <= MAX_FILE_SIZE) {
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Canvas context not available'))
      return
    }

    img.onload = () => {
      // 원본 크기
      let { width, height } = img

      // 비율 유지하면서 크기 조정
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      canvas.width = width
      canvas.height = height

      // 이미지 그리기
      ctx.drawImage(img, 0, 0, width, height)

      // Blob으로 변환 (JPEG 형식)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'))
            return
          }

          // 새 파일 생성
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.jpg'),
            { type: 'image/jpeg' }
          )

          console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)

          resolve(compressedFile)
        },
        'image/jpeg',
        JPEG_QUALITY
      )
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    // 이미지 로드
    img.src = URL.createObjectURL(file)
  })
}

/**
 * 여러 이미지 파일을 압축합니다.
 * @param files 원본 이미지 파일 배열
 * @returns 압축된 이미지 파일 배열
 */
export async function compressImages(files: File[]): Promise<File[]> {
  const compressedFiles = await Promise.all(
    files.map(file => compressImage(file))
  )
  return compressedFiles
}
