const DEFAULT_OPTIONS = {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.78,
    targetMaxBytes: 750 * 1024,
    outputType: 'image/jpeg'
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function compressImageFile(file, options = {}) {
    const settings = {
        ...DEFAULT_OPTIONS,
        ...options
    };

    if (!file) {
        throw new Error('File belum dipilih.');
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error('Format foto harus JPG, PNG, atau WebP.');
    }

    const image = await loadImage(file);
    const size = calculateContainSize(
        image.naturalWidth || image.width,
        image.naturalHeight || image.height,
        settings.maxWidth,
        settings.maxHeight
    );

    let quality = settings.quality;
    let width = size.width;
    let height = size.height;
    let blob = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
        blob = await renderToBlob(image, width, height, settings.outputType, quality);

        if (blob.size <= settings.targetMaxBytes) {
            break;
        }

        if (quality > 0.52) {
            quality -= 0.08;
        } else {
            width = Math.round(width * 0.86);
            height = Math.round(height * 0.86);
        }
    }

    const compressedFile = new File(
        [blob],
        createCompressedFileName(file.name),
        {
            type: settings.outputType,
            lastModified: Date.now()
        }
    );

    return {
        file: compressedFile,
        originalName: file.name,
        originalSize: file.size,
        compressedSize: compressedFile.size,
        width,
        height,
        mimeType: settings.outputType
    };
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(
                new Error(
                    'Foto gagal dibaca. Coba gunakan format JPG, PNG, atau WebP.'
                )
            );
        };

        image.src = url;
    });
}

function calculateContainSize(width, height, maxWidth, maxHeight) {
    if (width <= maxWidth && height <= maxHeight) {
        return {
            width,
            height
        };
    }

    const ratio = Math.min(maxWidth / width, maxHeight / height);

    return {
        width: Math.round(width * ratio),
        height: Math.round(height * ratio)
    };
}

function renderToBlob(image, width, height, type, quality) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', {
            alpha: false
        });

        canvas.width = width;
        canvas.height = height;

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error('Gagal mengompres foto nota.'));
                    return;
                }

                resolve(blob);
            },
            type,
            quality
        );
    });
}

function createCompressedFileName(originalName) {
    const baseName = String(originalName || 'nota')
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

    return `${baseName || 'nota'}-compressed.jpg`;
}

export function formatFileSize(bytes) {
    const size = Number(bytes || 0);

    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(0)} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(2)} MB`;
}