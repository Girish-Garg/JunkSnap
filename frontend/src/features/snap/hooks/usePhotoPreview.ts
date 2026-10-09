import { useCallback } from 'react';

/** A ref for an img that shows JPEG bytes from memory and frees the object URL on unmount. */
export function usePhotoPreview(bytes: ArrayBuffer) {
  return useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return undefined;
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
      img.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [bytes],
  );
}
