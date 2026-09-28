/** The colours and fonts a PowerPoint export uses. Hex without `#`, as PowerPoint wants them. */
export interface PptxTheme {
  readonly font: string
  readonly codeFont: string
  readonly text: string
  readonly surface: string
  readonly inverseText: string
  readonly inverseSurface: string
  readonly muted: string
  /** Body text size in points; headings and code scale from it. */
  readonly fontSize: number
}

export const DEFAULT_PPTX_THEME: PptxTheme = {
  font: 'Arial',
  codeFont: 'Courier New',
  text: '1E1E1E',
  surface: 'FFFFFF',
  inverseText: 'FFFFFF',
  inverseSurface: '1E1E1E',
  muted: '6B6B6B',
  fontSize: 18,
}
