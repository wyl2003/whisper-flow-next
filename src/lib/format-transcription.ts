interface Segment {
  id: number
  start: number
  end: number
  text: string
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms
    .toString()
    .padStart(3, "0")}`
}

export function generateSRT(segments: Segment[]): string {
  return segments
    .map((segment, index) => {
      return `${index + 1}
${formatTimestamp(segment.start)} --> ${formatTimestamp(segment.end)}
${segment.text.trim()}
`
    })
    .join("\n")
}

export function generateVTT(segments: Segment[]): string {
  return `WEBVTT

${segments
  .map((segment) => {
    return `${formatTimestamp(segment.start).replace(",", ".")} --> ${formatTimestamp(
      segment.end
    ).replace(",", ".")}
${segment.text.trim()}
`
  })
  .join("\n")}`
} 