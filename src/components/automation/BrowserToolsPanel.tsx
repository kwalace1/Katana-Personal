import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Camera,
  Download,
  FileInput,
  Loader2,
  MousePointer,
} from 'lucide-react'
import { runBrowserTool } from '@/lib/automation-api'
import type { AutomationBrowserResult, AutomationBrowserTool } from '@/lib/automation-browser'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { AutomationTabLayoutProps } from '@/lib/automation/automation-widget-layout'

interface BrowserToolsPanelProps {
  onChanged?: () => void
  onOpenAgent?: () => void
  layout: AutomationTabLayoutProps
}

export function BrowserToolsPanel({ onChanged, onOpenAgent, layout }: BrowserToolsPanelProps) {
  const [running, setRunning] = useState<AutomationBrowserTool | null>(null)
  const [lastResult, setLastResult] = useState<AutomationBrowserResult | null>(null)

  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [screenshotSelector, setScreenshotSelector] = useState('')

  const [textUrl, setTextUrl] = useState('')
  const [textSelector, setTextSelector] = useState('')

  const [formUrl, setFormUrl] = useState('')
  const [formDataJson, setFormDataJson] = useState('{"name": "John", "email": "john@example.com"}')

  const [clickUrl, setClickUrl] = useState('')
  const [clickSequence, setClickSequence] = useState('.button1, .button2')

  const [downloadUrl, setDownloadUrl] = useState('')

  const run = async (tool: AutomationBrowserTool) => {
    setRunning(tool)
    setLastResult(null)
    try {
      let result: AutomationBrowserResult

      if (tool === 'screenshot') {
        if (!screenshotUrl.trim()) {
          toast.error('Enter a URL')
          return
        }
        result = await runBrowserTool({
          tool: 'screenshot',
          url: screenshotUrl.trim(),
          selector: screenshotSelector.trim() || undefined,
        })
      } else if (tool === 'extract_text') {
        if (!textUrl.trim()) {
          toast.error('Enter a URL')
          return
        }
        result = await runBrowserTool({
          tool: 'extract_text',
          url: textUrl.trim(),
          selector: textSelector.trim() || undefined,
        })
      } else if (tool === 'fill_form') {
        if (!formUrl.trim()) {
          toast.error('Enter a URL')
          return
        }
        let formData: Record<string, string> = {}
        try {
          const parsed = JSON.parse(formDataJson || '{}') as Record<string, unknown>
          formData = Object.fromEntries(
            Object.entries(parsed).map(([k, v]) => [k, String(v ?? '')]),
          )
        } catch {
          toast.error('Form data must be valid JSON')
          return
        }
        result = await runBrowserTool({
          tool: 'fill_form',
          url: formUrl.trim(),
          formData,
        })
      } else if (tool === 'click') {
        if (!clickUrl.trim()) {
          toast.error('Enter a URL')
          return
        }
        const sequence = clickSequence
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        if (sequence.length === 0) {
          toast.error('Enter at least one CSS selector')
          return
        }
        result = await runBrowserTool({
          tool: 'click',
          url: clickUrl.trim(),
          clickSequence: sequence,
        })
      } else {
        if (!downloadUrl.trim()) {
          toast.error('Enter a file URL')
          return
        }
        result = await runBrowserTool({
          tool: 'download',
          url: downloadUrl.trim(),
        })
      }

      setLastResult(result)
      onChanged?.()
      if (result.ok) {
        toast.success(
          tool === 'download'
            ? 'Download started'
            : tool === 'screenshot'
              ? 'Screenshot ready'
              : 'Tool completed',
        )
      } else {
        toast.error(result.error || 'Tool failed')
      }
    } finally {
      setRunning(null)
    }
  }

  return (
    <div data-tour="automation-tools-panel">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId): ReactNode => {
          if (widgetId === 'browser_tools') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Web tools</CardTitle>
                  <CardDescription>
                    Fetch public pages over HTTP: screenshots (thumbnail service), extract text,
                    submit simple HTML forms, follow &lt;a href&gt; links, and download files. Not
                    a full browser — JS-heavy sites may not work.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="screenshot">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="screenshot">Screenshot</TabsTrigger>
                      <TabsTrigger value="text">Get Text</TabsTrigger>
                      <TabsTrigger value="form">Fill Form</TabsTrigger>
                      <TabsTrigger value="click">Click</TabsTrigger>
                      <TabsTrigger value="download">Download</TabsTrigger>
                    </TabsList>

                    <TabsContent value="screenshot" className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="url">URL</Label>
                        <Input
                          id="url"
                          placeholder="https://example.com"
                          value={screenshotUrl}
                          onChange={(e) => setScreenshotUrl(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="selector">Element Selector (optional, logged only)</Label>
                        <Input
                          id="selector"
                          placeholder=".main-content"
                          value={screenshotSelector}
                          onChange={(e) => setScreenshotSelector(e.target.value)}
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={running !== null}
                        onClick={() => void run('screenshot')}
                      >
                        {running === 'screenshot' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="mr-2 h-4 w-4" />
                        )}
                        Take Screenshot
                      </Button>
                    </TabsContent>

                    <TabsContent value="text" className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="url-text">URL</Label>
                        <Input
                          id="url-text"
                          placeholder="https://example.com"
                          value={textUrl}
                          onChange={(e) => setTextUrl(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="selector-text">Element Selector (optional)</Label>
                        <Input
                          id="selector-text"
                          placeholder=".article-content"
                          value={textSelector}
                          onChange={(e) => setTextSelector(e.target.value)}
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={running !== null}
                        onClick={() => void run('extract_text')}
                      >
                        {running === 'extract_text' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileInput className="mr-2 h-4 w-4" />
                        )}
                        Extract Text
                      </Button>
                    </TabsContent>

                    <TabsContent value="form" className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="url-form">URL</Label>
                        <Input
                          id="url-form"
                          placeholder="https://example.com/form"
                          value={formUrl}
                          onChange={(e) => setFormUrl(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="form-data">Form Data (JSON)</Label>
                        <Textarea
                          id="form-data"
                          rows={3}
                          value={formDataJson}
                          onChange={(e) => setFormDataJson(e.target.value)}
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={running !== null}
                        onClick={() => void run('fill_form')}
                      >
                        {running === 'fill_form' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <MousePointer className="mr-2 h-4 w-4" />
                        )}
                        Fill & Submit Form
                      </Button>
                    </TabsContent>

                    <TabsContent value="click" className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="url-click">URL</Label>
                        <Input
                          id="url-click"
                          placeholder="https://example.com"
                          value={clickUrl}
                          onChange={(e) => setClickUrl(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="click-sequence">
                          Click Sequence (comma-separated link selectors)
                        </Label>
                        <Input
                          id="click-sequence"
                          placeholder=".nav-about, .docs-link"
                          value={clickSequence}
                          onChange={(e) => setClickSequence(e.target.value)}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Follows matching &lt;a href&gt; links in order (CSS id/class or link text).
                        </p>
                      </div>
                      <Button
                        className="w-full"
                        disabled={running !== null}
                        onClick={() => void run('click')}
                      >
                        {running === 'click' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <MousePointer className="mr-2 h-4 w-4" />
                        )}
                        Execute Clicks
                      </Button>
                    </TabsContent>

                    <TabsContent value="download" className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="url-download">File URL</Label>
                        <Input
                          id="url-download"
                          placeholder="https://example.com/file.pdf"
                          value={downloadUrl}
                          onChange={(e) => setDownloadUrl(e.target.value)}
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={running !== null}
                        onClick={() => void run('download')}
                      >
                        {running === 'download' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Download File
                      </Button>
                    </TabsContent>
                  </Tabs>

                  {lastResult && (
                    <div className="mt-6 space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {lastResult.ok ? 'Result' : 'Failed'} — {lastResult.tool}
                        </p>
                        {lastResult.statusCode != null && (
                          <span className="text-xs text-muted-foreground">
                            HTTP {lastResult.statusCode}
                          </span>
                        )}
                      </div>
                      {lastResult.error && (
                        <p className="text-sm text-destructive">{lastResult.error}</p>
                      )}
                      {lastResult.screenshotUrl && (
                        <div className="space-y-2">
                          <a
                            href={lastResult.screenshotUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary underline"
                          >
                            Open screenshot
                          </a>
                          <img
                            src={lastResult.screenshotUrl}
                            alt="Page screenshot"
                            className="max-h-80 w-full rounded-md border object-contain bg-muted"
                          />
                        </div>
                      )}
                      {lastResult.pagesVisited && lastResult.pagesVisited.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Visited: {lastResult.pagesVisited.join(' → ')}
                        </p>
                      )}
                      {lastResult.text && (
                        <Textarea
                          readOnly
                          rows={8}
                          value={lastResult.text}
                          className="font-mono text-xs"
                        />
                      )}
                    </div>
                  )}

                  <p className="mt-6 text-sm text-muted-foreground">
                    Private/local URLs are blocked. Click sequences follow public links only.
                  </p>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'agent_footer') {
            return (
              <Card className="h-full overflow-hidden">
                <CardContent className="flex h-full flex-wrap items-center justify-between gap-3 p-4">
                  <p className="text-sm text-muted-foreground">
                    Need help choosing a tool? Ask Automation Agent in Agent Office.
                  </p>
                  {onOpenAgent && (
                    <Button variant="outline" size="sm" onClick={onOpenAgent}>
                      Ask Automation Agent
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          }

          return null
        }}
      />
    </div>
  )
}
