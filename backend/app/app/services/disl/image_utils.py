import io
from typing import Tuple
from PIL import Image
import logging

logger = logging.getLogger(__name__)

MAX_SIZE = 5 * 1024 * 1024  # 5MB
MAX_DIM = 1600
MIN_QUALITY = 40


def resize_and_compress_image(contents: bytes) -> Tuple[bytes, str]:
    """
    Resize and compress image bytes to fit under MAX_SIZE.
    Returns (new_bytes, format)
    """
    try:
        image = Image.open(io.BytesIO(contents))
        quality = 85
        width, height = image.size
        fmt = image.format or 'JPEG'
        while True:
            buf = io.BytesIO()
            # Resize if very large
            if max(width, height) > MAX_DIM:
                scale = MAX_DIM / max(width, height)
                new_size = (int(width * scale), int(height * scale))
                # Use LANCZOS resampling for Pillow >=10
                try:
                    resample = Image.Resampling.LANCZOS
                except AttributeError:
                    resample = Image.LANCZOS
                image = image.resize(new_size, resample)
                width, height = image.size
            image.save(buf, format=fmt, quality=quality, optimize=True)
            data = buf.getvalue()
            if len(data) <= MAX_SIZE or quality <= MIN_QUALITY:
                logger.info(f"Image resized/compressed to {len(data)} bytes, quality={quality}")
                return data, fmt
            quality -= 10
        # Should not reach here
    except Exception as e:
        logger.error(f"Image resize/compression failed: {str(e)}")
        raise
