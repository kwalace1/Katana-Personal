declare module 'react-signature-canvas' {
  import type { Component } from 'react'

  export interface SignatureCanvasProps {
    penColor?: string
    backgroundColor?: string
    canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>
    clearOnResize?: boolean
    onEnd?: () => void
    onBegin?: () => void
  }

  export default class SignatureCanvas extends Component<SignatureCanvasProps> {
    clear(): void
    isEmpty(): boolean
    toDataURL(type?: string, encoderOptions?: number): string
    fromDataURL(dataURL: string): void
    getCanvas(): HTMLCanvasElement
    getTrimmedCanvas(): HTMLCanvasElement
  }
}
