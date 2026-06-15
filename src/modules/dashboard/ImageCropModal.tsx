import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { X, Crop as CropIcon, ZoomIn } from 'lucide-react';

interface ImageCropModalProps {
  /** Fonte da imagem a recortar (objectURL local ou URL pública do Storage). */
  imageSrc: string;
  /** Proporção do recorte. Padrão 16:9. */
  aspect?: number;
  /** Largura final do recorte em px (altura = width / aspect). Padrão 1920. */
  outputWidth?: number;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
}

/** Carrega a imagem garantindo CORS para permitir export via canvas (Supabase envia ACAO: *). */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/** Desenha a área recortada num canvas na resolução final e exporta JPEG. */
async function getCroppedBlob(
  src: string,
  area: Area,
  outputWidth: number,
  aspect: number,
): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  const outputHeight = Math.round(outputWidth / aspect);
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas não suportado neste navegador.');
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar o recorte.'))),
      'image/jpeg',
      0.9,
    );
  });
}

export default function ImageCropModal({
  imageSrc,
  aspect = 16 / 9,
  outputWidth = 1920,
  onCancel,
  onConfirm,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, outputWidth, aspect);
      await onConfirm(blob);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível recortar a imagem.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#0d0d0d] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
              <CropIcon className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-serif text-white uppercase tracking-widest">Cortar Imagem</h3>
          </div>
          <button
            onClick={onCancel}
            disabled={saving}
            className="text-white/50 hover:text-white transition disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Área de corte */}
        <div className="relative w-full aspect-[16/9] bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
            objectFit="contain"
          />
        </div>

        {/* Controles */}
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <ZoomIn className="w-4 h-4 text-white/50 shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[#d4af37]"
              aria-label="Zoom"
            />
          </div>
          <p className="text-[9px] text-[#d4af37]/80 uppercase tracking-widest text-center">
            Recorte 16:9 · resultado {outputWidth}×{Math.round(outputWidth / aspect)}px
          </p>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border border-white/15 text-xs font-bold uppercase tracking-widest text-white/70 hover:text-white hover:border-white/30 transition disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || !croppedAreaPixels}
              className="flex-1 py-3 rounded-xl bg-[#d4af37] text-black text-xs font-bold uppercase tracking-widest hover:bg-[#e5c456] transition disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Aplicar Corte'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
