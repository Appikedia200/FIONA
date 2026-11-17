import { ImageResponse } from 'next/og'
 
export const size = {
  width: 32,
  height: 32,
}
 
export const contentType = 'image/png'
 
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0C0E14',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 8L8 4L12 8M8 4V14"
            stroke="#4F7FFF"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <path
            d="M20 16L16 20L12 16M16 20V10"
            stroke="#4F7FFF"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <circle cx="12" cy="12" r="2" fill="#4F7FFF" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
