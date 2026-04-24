import { SandpackProvider, SandpackPreview, SandpackLayout } from '@codesandbox/sandpack-react'

// Reset html/body so artifacts using `min-h-screen` actually fill the iframe,
// and so default 8px body margin doesn't leave a visible gutter at the edges.
const TAILWIND_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      html, body, #root { height: 100%; margin: 0; }
      body { background: white; }
    </style>
    <title>Preview</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

interface SandpackArtifactPreviewProps {
  code: string
  filename: string
}

// Lazy-loaded Sandpack runtime for previewing React artifacts (.jsx/.tsx)
// dropped onto a card. Mirrors Claude's artifact preview pane: the source
// becomes App.(j|t)sx, react/react-dom come from the template, common
// artifact deps (lucide-react, recharts) are pre-declared, and Tailwind is
// pulled from the Play CDN so utility classes render. Runs in Sandpack's
// sandboxed iframe so the artifact's network calls can't touch the host
// Supabase session.
export function SandpackArtifactPreview({ code, filename }: SandpackArtifactPreviewProps) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'tsx'
  const isJs = ext === 'jsx' || ext === 'js' || ext === 'mjs' || ext === 'cjs'
  const entry = isJs ? '/App.js' : '/App.tsx'
  const template = isJs ? 'react' : 'react-ts'

  return (
    <SandpackProvider
      template={template}
      theme="light"
      files={{
        [entry]: code,
        '/public/index.html': TAILWIND_HTML,
      }}
      customSetup={{
        dependencies: {
          'lucide-react': 'latest',
          'recharts': 'latest',
          'framer-motion': 'latest',
        },
      }}
      style={{ height: '100%', width: '100%' }}
    >
      <SandpackLayout style={{ height: '100%', border: 'none', borderRadius: 0 }}>
        <SandpackPreview
          style={{ height: '100%', flex: 1, border: 'none' }}
          showOpenInCodeSandbox={false}
          showRefreshButton
        />
      </SandpackLayout>
    </SandpackProvider>
  )
}
