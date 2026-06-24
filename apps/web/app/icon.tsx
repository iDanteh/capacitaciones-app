import { ImageResponse } from 'next/og';

export const size        = { width: 32, height: 32 };
export const contentType = 'image/png';

// Genera el ícono de Capta como PNG — necesario para Safari y navegadores
// que no soportan SVG como favicon. El icon.svg se mantiene como mask-icon.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          background: '#0B2840',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            width: 22,
            height: 22,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Círculo completo con borde verde */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3.5px solid #7FD1AE',
            }}
          />
          {/* Tapa la abertura derecha (~64°) para formar la "C" */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 5,
              width: 5,
              height: 12,
              background: '#0B2840',
            }}
          />
          {/* Punto en el extremo de la "C" */}
          <div
            style={{
              position: 'absolute',
              right: -1,
              top: 7,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#7FD1AE',
              border: '2px solid #0B2840',
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
