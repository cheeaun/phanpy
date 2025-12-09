import './qr-code.css';

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import encodeQR from 'qr';

const canvas = window.OffscreenCanvas
  ? new OffscreenCanvas(1, 1)
  : document.createElement('canvas');
const ctx = canvas.getContext('2d', {
  willReadFrequently: true,
});
ctx.imageSmoothingEnabled = false;

export default function QrCode({
  text,
  arena,
  backgroundMask,
  arenaCircle = true,
  caption,
}) {
  const captionRef = useRef(null);
  const [captionHeight, setCaptionHeight] = useState(0);
  const [arenaLoaded, setArenaLoaded] = useState(false);
  const [arenaHasAlpha, setArenaHasAlpha] = useState(false);

  const effectiveArenaCircle = arenaHasAlpha ? false : arenaCircle;

  useEffect(() => {
    if (caption && captionRef.current) {
      const height = captionRef.current.offsetHeight;
      setCaptionHeight(height);
    }
  }, [caption]);

  useEffect(() => {
    if (arena) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setArenaLoaded(true);
        try {
          const { width, height } = img;
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0);
          const allPixels = ctx.getImageData(0, 0, width, height);
          const data = allPixels.data;
          const totalPixels = data.length / 4;
          let lowAlphaCount = 0;
          let hasAlpha = false;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] <= 128) lowAlphaCount++;
            if (lowAlphaCount / totalPixels > 0.1) {
              hasAlpha = true;
              break;
            }
          }
          setArenaHasAlpha(hasAlpha);
        } catch (e) {
          setArenaHasAlpha(false);
        }
      };
      img.onerror = (error) => {
        console.error('Failed to load arena image:', error);
        setArenaLoaded(true); // Still show the image even on CORS error
      };
      img.src = arena;
    } else {
      setArenaLoaded(false);
    }
  }, [arena]);

  if (!text) return null;

  const qrData = useMemo(
    () =>
      encodeQR(text, 'raw', {
        ecc: 'high',
        border: 0,
        scale: 1,
      }),
    [text],
  );
  const gridSize = qrData.length;

  const centerExcludeSize = arenaLoaded ? Math.ceil(gridSize * 0.3) : 0;
  const centerStart = Math.floor((gridSize - centerExcludeSize) / 2);
  const centerEnd = centerStart + centerExcludeSize;

  const isFilled = (x, y) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return false;

    if (
      arenaLoaded &&
      x >= centerStart &&
      x < centerEnd &&
      y >= centerStart &&
      y < centerEnd
    ) {
      if (arenaCircle) {
        const centerX = (centerStart + centerEnd) / 2;
        const centerY = (centerStart + centerEnd) / 2;
        const radius = centerExcludeSize / 2;
        const dx = x + 0.5 - centerX;
        const dy = y + 0.5 - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < radius) return false;
      } else {
        return false;
      }
    }

    return qrData[y][x];
  };

  const isFilledInGrid = (x, y) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return false;
    return isFilled(x, y);
  };

  const isInPositionMarker = (x, y) => {
    if (x < 7 && y < 7) return true;
    if (x >= gridSize - 7 && y < 7) return true;
    if (x < 7 && y >= gridSize - 7) return true;
    return false;
  };

  const pathData = useMemo(() => {
    let data = '';

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (!isFilledInGrid(x, y)) continue;
        if (isInPositionMarker(x, y)) continue;

        const cx = x + 0.5;
        const cy = y + 0.5;
        const hasTop =
          isFilledInGrid(x, y - 1) && !isInPositionMarker(x, y - 1);
        const hasRight =
          isFilledInGrid(x + 1, y) && !isInPositionMarker(x + 1, y);
        const hasBottom =
          isFilledInGrid(x, y + 1) && !isInPositionMarker(x, y + 1);
        const hasLeft =
          isFilledInGrid(x - 1, y) && !isInPositionMarker(x - 1, y);

        if (hasRight) {
          data += `M ${cx} ${cy} L ${cx + 1} ${cy} `;
        }
        if (hasBottom) {
          data += `M ${cx} ${cy} L ${cx} ${cy + 1} `;
        }
        if (!hasTop && !hasRight && !hasBottom && !hasLeft) {
          data += `M ${cx} ${cy} L ${cx} ${cy} `;
        }
      }
    }

    return data;
  }, [
    gridSize,
    qrData,
    arenaLoaded,
    centerStart,
    centerEnd,
    centerExcludeSize,
    effectiveArenaCircle,
  ]);

  const markerPositions = [
    { x: 0, y: 0 }, // Top-left
    { x: gridSize - 7, y: 0 }, // Top-right
    { x: 0, y: gridSize - 7 }, // Bottom-left
  ];

  const markerOuterRadius = 1.1; // Outer 7x7 square corner radius
  const markerInnerRadius = 0.6; // Inner 3x3 square corner radius

  const centerImagePadding = 1; // 1 cell width padding around the image
  const centerImageSize = centerExcludeSize - centerImagePadding * 2;
  const centerImageX = centerStart + centerImagePadding;
  const centerImageY = centerStart + centerImagePadding;
  const padding = 2;
  const captionSpacing = 2; // Space between QR code and caption

  const viewBoxWidth = gridSize + padding * 2;
  const viewBoxHeight =
    gridSize + padding * 2 + (caption ? captionSpacing + captionHeight : 0);
  const bleed = viewBoxWidth * 0.25;

  return (
    <svg
      class="qr-code"
      viewBox={`${-padding} ${-padding} ${viewBoxWidth} ${viewBoxHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      shape-rendering="geometricPrecision"
    >
      <defs>
        <g id="position-marker">
          <rect
            x="0.5"
            y="0.5"
            width="6"
            height="6"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
            rx={markerOuterRadius}
            ry={markerOuterRadius}
          />
          <rect
            x="2"
            y="2"
            width="3"
            height="3"
            fill="currentColor"
            rx={markerInnerRadius}
            ry={markerInnerRadius}
          />
        </g>
        <g id="position-marker-mask">
          <rect
            x="0.5"
            y="0.5"
            width="6"
            height="6"
            fill="none"
            stroke="white"
            stroke-width="1"
            rx={markerOuterRadius}
            ry={markerOuterRadius}
          />
          <rect
            x="2"
            y="2"
            width="3"
            height="3"
            fill="white"
            rx={markerInnerRadius}
            ry={markerInnerRadius}
          />
        </g>
        {backgroundMask && (
          <filter id="blur-mask">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            <feColorMatrix type="saturate" values="2" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="1.2" intercept="0.3" />
              <feFuncG type="linear" slope="1.2" intercept="0.3" />
              <feFuncB type="linear" slope="1.2" intercept="0.3" />
            </feComponentTransfer>
          </filter>
        )}
        {backgroundMask && (
          <mask id="qr-pattern-mask">
            <path
              fill="white"
              stroke="white"
              stroke-width="1"
              stroke-linejoin="round"
              stroke-linecap="round"
              d={pathData}
            />
            <g id="position-markers-mask">
              {markerPositions.map((pos) => (
                <use
                  key={`${pos.x}-${pos.y}`}
                  href="#position-marker-mask"
                  x={pos.x}
                  y={pos.y}
                />
              ))}
            </g>
            {arenaLoaded && effectiveArenaCircle && (
              <circle
                cx={centerImageX + centerImageSize / 2}
                cy={centerImageY + centerImageSize / 2}
                r={centerImageSize / 2}
                fill="black"
              />
            )}
            {arenaLoaded && !arenaCircle && (
              <rect
                x={centerImageX}
                y={centerImageY}
                width={centerImageSize}
                height={centerImageSize}
                fill="black"
              />
            )}
          </mask>
        )}
        <path
          id="qr-pattern"
          fill="currentColor"
          stroke="currentColor"
          stroke-width="1"
          stroke-linejoin="round"
          stroke-linecap="round"
          d={pathData}
        />
      </defs>
      <use href="#qr-pattern" />
      <g id="position-markers">
        {markerPositions.map((pos) => (
          <use
            key={`${pos.x}-${pos.y}`}
            href="#position-marker"
            x={pos.x}
            y={pos.y}
          />
        ))}
      </g>
      {backgroundMask && (
        <g mask="url(#qr-pattern-mask)">
          <image
            href={backgroundMask}
            x={-padding - bleed}
            y={-padding - bleed}
            width={viewBoxWidth + bleed * 2}
            height={viewBoxWidth + bleed * 2}
            preserveAspectRatio="none"
            opacity="0.5"
            filter="url(#blur-mask)"
          />
        </g>
      )}
      {arena && arenaLoaded && (
        <image
          href={arena}
          x={centerImageX}
          y={centerImageY}
          width={centerImageSize}
          height={centerImageSize}
          preserveAspectRatio="xMidYMid slice"
          clip-path={
            effectiveArenaCircle
              ? `circle(${centerImageSize / 2}px at ${centerImageSize / 2}px ${centerImageSize / 2}px)`
              : undefined
          }
        />
      )}
      {caption && (
        <foreignObject
          x={0}
          y={gridSize + captionSpacing}
          width={gridSize}
          height={captionHeight}
        >
          <div
            ref={captionRef}
            xmlns="http://www.w3.org/1999/xhtml"
            class="qr-code-caption"
            dangerouslySetInnerHTML={{ __html: caption }}
          />
        </foreignObject>
      )}
    </svg>
  );
}
