# React Streaming Markdown Playground

Press **Replay** to watch this guide arrive a few words at a time. Pause anywhere, or open **Source** and try your own response.

## Render the text you have

Streaming uses the same component as a finished document. Append each incoming chunk to a string and pass that string to the renderer.

```tsx
import Markdown from '@react-markdown-kit/renderer'

function Reply({ textSoFar }: { textSoFar: string }) {
  return <Markdown>{textSoFar}</Markdown>
}
```

No separate streaming mode is required. An unfinished paragraph, list, or code fence is still a renderable document.

## Watch structure appear

As the characters arrive, **emphasis closes**, links gain their destinations, and the table below takes shape.

| Stage | What the renderer receives |
| --- | --- |
| First chunk | A partial heading |
| More chunks | The complete prefix so far |
| Final chunk | The whole document |

Each update parses and renders that prefix. Your application owns the network connection, buffering, cancellation, and error handling.

## Try different boundaries

Use a slower speed to see intermediate states. Edit the source to include your own lists, code, or tables.

- A list can grow one item at a time.
- A code fence can arrive before its closing fence.
- Reference links can change when their definitions arrive.

> A partial document can change its interpretation as more text arrives. Test with the same kinds of responses your application expects.

## Connect your stream

Keep the accumulated text in React state. After each decoded network chunk, append it and let React render the next prefix. Abort the request when the user cancels or leaves the page.

See the [streaming guide](/streaming-markdown) for a fuller example, or [rendering](/markdown-renderer) to explore the syntax without playback.
