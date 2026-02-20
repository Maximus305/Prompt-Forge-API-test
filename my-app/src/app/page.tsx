"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import { Button } from "@/components/ui/button";

interface LogEntry {
  time: string;
  type: 'info' | 'success' | 'error' | 'data';
  message: string;
}

interface Meta {
  status: number;
  statusText: string;
  duration: number;
  responseHeaders: Record<string, string>;
}

interface Endpoint {
  id: string;
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  hasPromptId: boolean;
  hasBody: boolean;
  defaultBody?: string;
}

interface PromptVariable {
  variableId: string;
  name: string;
  description: string | null;
  dataType: string;
  required: boolean;
}

interface CompileResponse {
  compiled: string;
  promptId: string;
  version: string;
  variables: string[];
}

interface SavedTest {
  id: string;
  name: string;
  promptId: string;
  variableValues: Record<string, string>;
  createdAt: number;
  lastRun?: number;
  lastStatus?: 'success' | 'error';
}

const ENDPOINTS: Endpoint[] = [
  {
    id: 'compile-prompt',
    label: 'Compile Prompt',
    method: 'POST',
    path: '/api/v1/prompts/:id/compile',
    description: 'Compile a prompt by substituting variables with provided values.',
    hasPromptId: true,
    hasBody: true,
    defaultBody: JSON.stringify({ variables: {} }, null, 2),
  },
  {
    id: 'list-prompts',
    label: 'List Prompts',
    method: 'GET',
    path: '/api/v1/prompts',
    description: 'Retrieve all production prompts in your workspace.',
    hasPromptId: false,
    hasBody: false,
  },
  {
    id: 'get-prompt',
    label: 'Get Prompt',
    method: 'GET',
    path: '/api/v1/prompts/:id',
    description: 'Retrieve a specific prompt by ID.',
    hasPromptId: true,
    hasBody: false,
  },
  {
    id: 'create-prompt',
    label: 'Create Prompt',
    method: 'POST',
    path: '/api/v1/prompts',
    description: 'Create a new prompt with a name and description.',
    hasPromptId: false,
    hasBody: true,
    defaultBody: JSON.stringify({ name: "My Prompt", description: "A new prompt" }, null, 2),
  },
  {
    id: 'update-prompt',
    label: 'Update Prompt',
    method: 'PUT',
    path: '/api/v1/prompts/:id',
    description: 'Update an existing prompt. Only include fields you want to change.',
    hasPromptId: true,
    hasBody: true,
    defaultBody: JSON.stringify({ description: "Updated description" }, null, 2),
  },
  {
    id: 'delete-prompt',
    label: 'Delete Prompt',
    method: 'DELETE',
    path: '/api/v1/prompts/:id',
    description: 'Permanently delete a prompt. This cannot be undone.',
    hasPromptId: true,
    hasBody: false,
  },
  {
    id: 'prompt-parameters',
    label: 'Prompt Parameters',
    method: 'GET',
    path: '/api/v1/prompts/:id/parameters',
    description: 'Returns the parameter schema for a prompt.',
    hasPromptId: true,
    hasBody: false,
  },
  {
    id: 'list-tools',
    label: 'List Tools',
    method: 'GET',
    path: '/api/v1/tools',
    description: 'Retrieve all tool definitions in your workspace.',
    hasPromptId: false,
    hasBody: false,
  },
  {
    id: 'get-tool',
    label: 'Get Tool',
    method: 'GET',
    path: '/api/v1/tools/:id',
    description: 'Retrieve a specific tool definition by ID.',
    hasPromptId: true,
    hasBody: false,
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  POST: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  PUT: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  DELETE: 'bg-red-500/10 text-red-600 border-red-500/20',
};

// Parse structured API errors into friendly messages
function parseApiError(raw: string): { message: string; hint?: string } {
  try {
    const parsed = JSON.parse(raw);
    const err = parsed?.error;
    if (err?.message) {
      if (err.type === 'forbidden' && err.message.includes('not in production')) {
        const match = err.message.match(/current status: (\w+)/);
        const status = match?.[1] || 'unknown';
        return {
          message: `Prompt is in "${status}" status`,
          hint: 'Set the prompt to "In Production" in PromptForge before compiling via API.',
        };
      }
      return { message: err.message };
    }
  } catch {
    // not JSON
  }
  return { message: raw };
}

function CompileResponseView({ data, markdown }: { data: CompileResponse; markdown: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.compiled);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="relative">
        <button
          onClick={handleCopy}
          className="absolute right-4 top-4 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {markdown ? (
          <div className="rounded-lg border bg-muted/30 p-6 pr-24 prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-pre:bg-[hsl(var(--secondary))] prose-pre:text-foreground prose-pre:border prose-pre:text-sm prose-code:text-foreground prose-code:bg-[hsl(var(--secondary))] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
            <Markdown>{data.compiled}</Markdown>
          </div>
        ) : (
          <pre className="rounded-lg border bg-muted/30 p-6 pr-24 font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {data.compiled}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function PromptForge() {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [mode, setMode] = useState<'compile' | 'tests' | 'explorer'>('compile');
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(ENDPOINTS[0]);
  const [resourceId, setResourceId] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorHint, setErrorHint] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Compile-specific state
  const [parameters, setParameters] = useState<PromptVariable[]>([]);
  const [paramPromptName, setParamPromptName] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [loadingParams, setLoadingParams] = useState(false);
  const [paramsLoaded, setParamsLoaded] = useState(false);
  const [paramsError, setParamsError] = useState('');
  const [compileResult, setCompileResult] = useState<CompileResponse | null>(null);
  const [responseView, setResponseView] = useState<'formatted' | 'markdown' | 'raw'>('formatted');
  const [logOpen, setLogOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Tests state
  const [savedTests, setSavedTests] = useState<SavedTest[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveTestName, setSaveTestName] = useState('');
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: 'success' | 'error'; response: string; compileResult?: CompileResponse }>>({});
  const [generatingVar, setGeneratingVar] = useState<string | null>(null);
  const [aiModalParam, setAiModalParam] = useState<PromptVariable | null>(null);
  const [aiInstruction, setAiInstruction] = useState('');
  const pendingTestRef = useRef<{ values: Record<string, string>; autoSubmit: boolean } | null>(null);
  const handleSubmitRef = useRef<() => void>(() => {});

  const isCompile = mode === 'compile';

  // ── localStorage persistence ──
  useEffect(() => {
    const savedKey = localStorage.getItem('pf_apiKey');
    const savedUrl = localStorage.getItem('pf_baseUrl');
    const savedTestsRaw = localStorage.getItem('pf_tests');
    if (savedKey) setApiKey(savedKey);
    if (savedUrl) setBaseUrl(savedUrl);
    else setBaseUrl('https://main.d2r2bhlvzb3q6.amplifyapp.com');
    if (savedTestsRaw) {
      try { setSavedTests(JSON.parse(savedTestsRaw)); } catch { /* ignore */ }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('pf_apiKey', apiKey);
  }, [apiKey, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('pf_baseUrl', baseUrl);
  }, [baseUrl, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('pf_tests', JSON.stringify(savedTests));
  }, [savedTests, hydrated]);

  useEffect(() => {
    setBody(selectedEndpoint.defaultBody || '');
    setError('');
    setErrorHint('');
    setCompileResult(null);
    setResponseView('formatted');
  }, [selectedEndpoint]);

  const fetchParameters = useCallback(async () => {
    if (!baseUrl || !apiKey || !resourceId) {
      setParamsError('Enter Base URL, API Key, and Prompt ID first');
      return;
    }

    setLoadingParams(true);
    setParamsError('');

    try {
      const base = baseUrl.replace(/\/+$/, '');
      const targetUrl = `${base}/api/v1/prompts/${resourceId}/parameters`;

      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl, apiKey, method: 'GET' }),
      });

      const data = await res.json();

      if (data.error && !data.result) {
        setParamsError(data.error);
        return;
      }

      const result = data.result;
      if (result?.error) {
        const parsed = parseApiError(JSON.stringify(result));
        setParamsError(parsed.message);
        return;
      }

      if (result?.data?.variables) {
        setParameters(result.data.variables);
        setParamPromptName(result.data.name || '');
        const initial: Record<string, string> = {};
        for (const v of result.data.variables) {
          initial[v.variableId] = '';
        }
        if (pendingTestRef.current) {
          const merged = { ...initial, ...pendingTestRef.current.values };
          setVariableValues(merged);
          if (pendingTestRef.current.autoSubmit) {
            setTimeout(() => handleSubmitRef.current(), 50);
          }
          pendingTestRef.current = null;
        } else {
          setVariableValues(initial);
        }
        setParamsLoaded(true);
      } else if (result?.variables) {
        setParameters(result.variables);
        setParamPromptName(result.name || '');
        const initial: Record<string, string> = {};
        for (const v of result.variables) {
          initial[v.variableId] = '';
        }
        if (pendingTestRef.current) {
          const merged = { ...initial, ...pendingTestRef.current.values };
          setVariableValues(merged);
          if (pendingTestRef.current.autoSubmit) {
            setTimeout(() => handleSubmitRef.current(), 50);
          }
          pendingTestRef.current = null;
        } else {
          setVariableValues(initial);
        }
        setParamsLoaded(true);
      } else {
        setParamsError('Unexpected response format');
      }
    } catch (err) {
      setParamsError(err instanceof Error ? err.message : 'Failed to fetch parameters');
    } finally {
      setLoadingParams(false);
    }
  }, [baseUrl, apiKey, resourceId]);

  // Auto-fetch parameters when prompt ID / apiKey / baseUrl changes in compile mode
  useEffect(() => {
    setParameters([]);
    setVariableValues({});
    setParamsLoaded(false);
    setParamsError('');
    setCompileResult(null);
    setResponse('');
    setError('');
    setErrorHint('');

    if (isCompile && resourceId && apiKey && baseUrl) {
      setLoadingParams(true);
      const timer = setTimeout(() => {
        fetchParameters();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [resourceId, apiKey, baseUrl, isCompile, fetchParameters]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // Sync variable form values into the body JSON
  useEffect(() => {
    if (isCompile && paramsLoaded) {
      const variables: Record<string, string> = {};
      for (const [key, val] of Object.entries(variableValues)) {
        if (val.trim()) variables[key] = val;
      }
      setBody(JSON.stringify({ variables }, null, 2));
    }
  }, [variableValues, isCompile, paramsLoaded]);

  const addLog = (type: LogEntry['type'], message: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { time, type, message }]);
  };

  const buildUrl = () => {
    const base = baseUrl.replace(/\/+$/, '');
    const ep = isCompile ? ENDPOINTS[0] : selectedEndpoint;
    let path = ep.path;
    if (ep.hasPromptId && resourceId) {
      path = path.replace(':id', resourceId);
    }
    return `${base}${path}`;
  };

  const handleSubmit = async () => {
    if (!baseUrl || !apiKey) {
      setError('Please enter a Base URL and API Key');
      setErrorHint('');
      return;
    }

    const ep = isCompile ? ENDPOINTS[0] : selectedEndpoint;

    if (ep.hasPromptId && !resourceId) {
      setError('Please enter a resource ID');
      setErrorHint('');
      return;
    }
    if (ep.hasBody && !body) {
      setError('Please enter a request body');
      setErrorHint('');
      return;
    }

    const targetUrl = buildUrl();

    setIsLoading(true);
    setError('');
    setErrorHint('');
    setResponse('');
    setCompileResult(null);
    setLogs([]);

    addLog('info', `${ep.method} ${targetUrl}`);
    addLog('info', `Authorization: Bearer ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);
    if (ep.hasBody && body) {
      addLog('info', `Body: ${body.length} bytes`);
    }
    addLog('info', 'Sending request...');

    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          apiKey,
          method: ep.method,
          body: ep.hasBody ? body : undefined,
        }),
      });

      const data = await res.json();
      const meta: Meta | undefined = data.meta;

      if (meta) {
        const isOk = meta.status >= 200 && meta.status < 300;
        addLog(
          isOk ? 'success' : 'error',
          `${meta.status} ${meta.statusText} (${meta.duration}ms)`
        );

        const h = meta.responseHeaders;
        if (h['x-ratelimit-remaining']) {
          addLog('info', `Rate limit: ${h['x-ratelimit-remaining']}/${h['x-ratelimit-limit'] || '?'} remaining`);
        }
        if (h['x-request-id']) {
          addLog('info', `Request ID: ${h['x-request-id']}`);
        }
      }

      if (data.error && !data.result) {
        addLog('error', data.error);
        setError(data.error);
      } else if (data.result?.error) {
        const parsed = parseApiError(JSON.stringify(data.result));
        addLog('error', parsed.message);
        setError(parsed.message);
        if (parsed.hint) setErrorHint(parsed.hint);
        setResponse(JSON.stringify(data.result, null, 2));
      } else {
        addLog('success', 'Response received');

        if (data.result) {
          setResponse(JSON.stringify(data.result, null, 2));

          if (isCompile) {
            const r = data.result?.data || data.result;
            if (r?.compiled && typeof r.compiled === 'string') {
              setCompileResult({
                compiled: r.compiled,
                promptId: r.promptId || resourceId,
                version: r.version || '?',
                variables: r.variables || [],
              });
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      addLog('error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  handleSubmitRef.current = handleSubmit;

  // ── Write with AI ──
  const generateVariable = async (param: PromptVariable, instruction: string) => {
    setGeneratingVar(param.variableId);
    try {
      const res = await fetch('/api/generate-variable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variableName: param.name,
          variableDescription: param.description,
          dataType: param.dataType,
          promptContext: paramPromptName || undefined,
          instruction,
          otherVariables: parameters
            .filter(p => p.variableId !== param.variableId && variableValues[p.variableId]?.trim())
            .map(p => ({ name: p.name, value: variableValues[p.variableId] })),
        }),
      });
      const data = await res.json();
      if (data.value) {
        setVariableValues(prev => ({ ...prev, [param.variableId]: data.value }));
      }
    } catch {
      // silently fail
    } finally {
      setGeneratingVar(null);
      setAiModalParam(null);
      setAiInstruction('');
    }
  };

  // ── Enter-key submission ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isCompile && requiredsFilled && !isLoading) {
        handleSubmit();
      }
    }
  };

  // ── Test functions ──
  const saveTest = () => {
    if (!saveTestName.trim() || !resourceId) return;
    const test: SavedTest = {
      id: `test_${Date.now()}`,
      name: saveTestName.trim(),
      promptId: resourceId,
      variableValues: { ...variableValues },
      createdAt: Date.now(),
    };
    setSavedTests(prev => [test, ...prev]);
    setSaveModalOpen(false);
    setSaveTestName('');
  };

  const deleteTest = (id: string) => {
    setSavedTests(prev => prev.filter(t => t.id !== id));
    setTestResults(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const runTest = async (test: SavedTest) => {
    if (!baseUrl || !apiKey) {
      setError('Please set Base URL and API Key in Settings first');
      return;
    }

    setRunningTestId(test.id);

    const base = baseUrl.replace(/\/+$/, '');
    const targetUrl = `${base}/api/v1/prompts/${test.promptId}/compile`;

    const variables: Record<string, string> = {};
    for (const [key, val] of Object.entries(test.variableValues)) {
      if (val.trim()) variables[key] = val;
    }
    const requestBody = JSON.stringify({ variables }, null, 2);

    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          apiKey,
          method: 'POST',
          body: requestBody,
        }),
      });

      const data = await res.json();

      if (data.error && !data.result) {
        setTestResults(prev => ({ ...prev, [test.id]: { status: 'error', response: data.error } }));
        setSavedTests(prev => prev.map(t => t.id === test.id ? { ...t, lastRun: Date.now(), lastStatus: 'error' as const } : t));
      } else if (data.result?.error) {
        const parsed = parseApiError(JSON.stringify(data.result));
        setTestResults(prev => ({ ...prev, [test.id]: { status: 'error', response: parsed.message + (parsed.hint ? `\n${parsed.hint}` : '') } }));
        setSavedTests(prev => prev.map(t => t.id === test.id ? { ...t, lastRun: Date.now(), lastStatus: 'error' as const } : t));
      } else if (data.result) {
        const r = data.result?.data || data.result;
        let cr: CompileResponse | undefined;
        if (r?.compiled && typeof r.compiled === 'string') {
          cr = {
            compiled: r.compiled,
            promptId: r.promptId || test.promptId,
            version: r.version || '?',
            variables: r.variables || [],
          };
        }
        setTestResults(prev => ({
          ...prev,
          [test.id]: {
            status: 'success',
            response: JSON.stringify(data.result, null, 2),
            compileResult: cr,
          },
        }));
        setSavedTests(prev => prev.map(t => t.id === test.id ? { ...t, lastRun: Date.now(), lastStatus: 'success' as const } : t));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setTestResults(prev => ({ ...prev, [test.id]: { status: 'error', response: msg } }));
      setSavedTests(prev => prev.map(t => t.id === test.id ? { ...t, lastRun: Date.now(), lastStatus: 'error' as const } : t));
    } finally {
      setRunningTestId(null);
    }
  };

  const runAllTests = async () => {
    for (const test of savedTests) {
      await runTest(test);
    }
  };

  const loadTestInCompile = (test: SavedTest, autoSubmit = false) => {
    pendingTestRef.current = { values: test.variableValues, autoSubmit };
    setCompileResult(null);
    setResponse('');
    setError('');
    setErrorHint('');
    setResourceId(test.promptId);
    setMode('compile');
  };

  const logColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-400';
      case 'data': return 'text-yellow-500';
      default: return 'text-muted-foreground';
    }
  };

  const connectionStatus = !apiKey
    ? { label: 'No API key', color: 'bg-amber-500' }
    : { label: 'Connected', color: 'bg-emerald-500' };

  const filledVarCount = (vals: Record<string, string>) =>
    Object.values(vals).filter(v => v.trim()).length;

  const requiredsFilled = paramsLoaded && parameters
    .filter(p => p.required)
    .every(p => variableValues[p.variableId]?.trim());

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar ── */}
      <div className="w-[220px] shrink-0 border-r bg-card flex flex-col overflow-hidden">
        {/* Logo */}
        <div className="px-4 py-4 border-b">
          <h1 className="text-sm font-bold tracking-tight text-foreground">PromptForge</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">API Tester</p>
        </div>

        {/* Nav */}
        <div className="px-3 py-3 space-y-0.5">
          {([
            { key: 'compile' as const, label: 'Compile' },
            { key: 'tests' as const, label: `Tests${savedTests.length > 0 ? ` (${savedTests.length})` : ''}` },
            { key: 'explorer' as const, label: 'API Explorer' },
          ]).map((item) => (
            <button
              key={item.key}
              onClick={() => setMode(item.key)}
              className={`w-full text-left rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                mode === item.key
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Settings */}
        <div className="px-3 py-3 border-t space-y-2.5">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground px-1">Base URL</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground px-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="pf_..."
              className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-auto px-3 py-3 border-t space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <span className={`h-1.5 w-1.5 rounded-full ${connectionStatus.color}`} />
            <span className="text-[11px] text-muted-foreground">{connectionStatus.label}</span>
          </div>
          <button
            onClick={() => setLogOpen(true)}
            className="w-full text-left rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            Activity Log{logs.length > 0 && ` (${logs.length})`}
          </button>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 overflow-auto">
        {mode === 'compile' ? (
          /* ═══ COMPILE MODE ═══ */
          <div className={`flex h-full ${!(compileResult || response || error) ? 'items-center justify-center' : ''}`}>
            {/* Left: Input */}
            <div className={`${compileResult || response || error ? 'w-[480px] shrink-0' : 'w-[480px]'} overflow-auto px-6 py-8 space-y-6`}>
              <div className="rounded-xl border bg-card shadow-sm">
                <div className="px-5 py-4 border-b">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Prompt ID</label>
                    {paramsLoaded && (
                      <Button
                        variant="outline"
                        onClick={() => { setSaveTestName(paramPromptName || resourceId); setSaveModalOpen(true); }}
                        className="h-7 text-[11px] px-3"
                      >
                        Save as Test
                      </Button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={resourceId}
                    onChange={(e) => setResourceId(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="prompt_abc123"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {loadingParams && (
                    <p className="mt-2 text-xs text-muted-foreground animate-pulse">Loading inputs...</p>
                  )}
                  {paramsError && (
                    <p className="mt-2 text-xs text-destructive">{paramsError}</p>
                  )}
                  {resourceId && apiKey && !loadingParams && (
                    <button
                      onClick={fetchParameters}
                      className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                      Reload inputs
                    </button>
                  )}
                </div>

                {paramsLoaded && parameters.length > 0 && (
                  <div className="px-5 py-4">
                    <div className="space-y-3">
                      {parameters.map((param) => (
                        <div key={param.variableId}>
                          <div className="flex items-center justify-between mb-1">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                              {param.name}
                              {param.required && (
                                <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500 border border-red-500/20">
                                  Required
                                </span>
                              )}
                            </label>
                            <button
                              onClick={() => { setAiModalParam(param); setAiInstruction(''); }}
                              disabled={generatingVar === param.variableId}
                              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                            >
                              {generatingVar === param.variableId ? 'Writing...' : 'Write with AI'}
                            </button>
                          </div>
                          <input
                            type="text"
                            value={variableValues[param.variableId] || ''}
                            onChange={(e) => setVariableValues(prev => ({ ...prev, [param.variableId]: e.target.value }))}
                            onKeyDown={handleKeyDown}
                            placeholder={`Enter ${param.name}...`}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {paramsLoaded && parameters.length === 0 && (
                  <div className="px-5 py-3">
                    <p className="text-xs text-muted-foreground">No input variables.</p>
                  </div>
                )}

                {(requiredsFilled || isLoading) && (
                  <div className="px-5 py-4 border-t animate-fade-slide-up">
                    <Button
                      onClick={handleSubmit}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? 'Compiling...' : 'Compile'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Response */}
            {(compileResult || response || error) && (
              <div className="flex-1 overflow-auto px-6 py-8 animate-fade-slide-in">
                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 mb-4">
                    <p className="text-sm font-medium text-red-500">{error}</p>
                    {errorHint && (
                      <p className="mt-1 text-xs text-red-400/80">{errorHint}</p>
                    )}
                  </div>
                )}

                {(compileResult || response) && (
                  <div>
                    {compileResult && response && (
                      <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5 mb-3 w-fit">
                        {(['formatted', 'markdown', 'raw'] as const).map((view) => (
                          <button
                            key={view}
                            onClick={() => setResponseView(view)}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                              responseView === view ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {view === 'formatted' ? 'Plain Text' : view === 'markdown' ? 'Markdown' : 'Raw JSON'}
                          </button>
                        ))}
                      </div>
                    )}
                    {compileResult && (responseView === 'formatted' || responseView === 'markdown') ? (
                      <CompileResponseView data={compileResult} markdown={responseView === 'markdown'} />
                    ) : response ? (
                      <pre className="rounded-xl border bg-muted/30 p-5 font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {response}
                      </pre>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>

        ) : mode === 'tests' ? (
          /* ═══ TESTS MODE ═══ */
          <div className="max-w-2xl mx-auto px-8 py-10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Saved Tests</h2>
              {savedTests.length > 1 && (
                <Button
                  variant="outline"
                  onClick={runAllTests}
                  disabled={runningTestId !== null}
                  className="text-xs h-8"
                >
                  Run All
                </Button>
              )}
            </div>

            {savedTests.length === 0 ? (
              <div className="rounded-xl border bg-card shadow-sm px-5 py-12 text-center">
                <p className="text-muted-foreground text-sm">No saved tests yet.</p>
                <p className="text-muted-foreground/60 text-xs mt-1">
                  Go to Compile, fill in variables, and click &quot;Save as Test&quot;.
                </p>
              </div>
            ) : (
              savedTests.map((test) => {
                const result = testResults[test.id];
                return (
                  <div key={test.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                    {/* Test header */}
                    <div className="px-5 py-3 flex items-center justify-between border-b">
                      <div className="flex items-center gap-2 min-w-0">
                        {test.lastStatus && (
                          <span className={`h-2 w-2 rounded-full shrink-0 ${test.lastStatus === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        )}
                        <span className="text-sm font-medium text-foreground truncate">{test.name}</span>
                        <code className="text-[11px] text-muted-foreground font-mono shrink-0">{test.promptId}</code>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => loadTestInCompile(test)}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Edit
                        </button>
                        <Button
                          variant="outline"
                          onClick={() => loadTestInCompile(test, true)}
                          className="text-xs h-7 px-3"
                        >
                          Run
                        </Button>
                        <button
                          onClick={() => deleteTest(test.id)}
                          className="text-[11px] text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Variable summary */}
                    <div className="px-5 py-2 border-b bg-muted/20">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(test.variableValues).map(([key, val]) => (
                          <span key={key} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px]">
                            <span className="font-mono text-muted-foreground">{key}</span>
                            {val.trim() ? (
                              <span className="text-foreground">{val.length > 30 ? val.slice(0, 30) + '...' : val}</span>
                            ) : (
                              <span className="text-muted-foreground/40 italic">empty</span>
                            )}
                          </span>
                        ))}
                        {Object.keys(test.variableValues).length === 0 && (
                          <span className="text-[11px] text-muted-foreground/40">No variables</span>
                        )}
                      </div>
                    </div>

                    {/* Last run info */}
                    <div className="px-5 py-2 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        {filledVarCount(test.variableValues)}/{Object.keys(test.variableValues).length} variables filled
                      </span>
                      {test.lastRun && (
                        <span className="text-[11px] text-muted-foreground">
                          Last run {new Date(test.lastRun).toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    {/* Result */}
                    {result && (
                      <div className="border-t">
                        {result.status === 'error' ? (
                          <div className="px-5 py-3 bg-red-500/5">
                            <p className="text-xs text-red-500">{result.response}</p>
                          </div>
                        ) : result.compileResult ? (
                          <div className="px-5 py-3">
                            <pre className="rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-[200px] overflow-auto">
                              {result.compileResult.compiled}
                            </pre>
                          </div>
                        ) : (
                          <div className="px-5 py-3">
                            <pre className="rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-[200px] overflow-auto">
                              {result.response}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        ) : (
          /* ═══ API EXPLORER MODE ═══ */
          <div className="max-w-2xl mx-auto px-8 py-10 space-y-6">
            {/* Endpoint picker */}
            <div className="flex flex-wrap gap-1.5">
              {ENDPOINTS.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => setSelectedEndpoint(ep)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors border ${
                    selectedEndpoint.id === ep.id
                      ? 'bg-primary/10 text-foreground border-primary/20'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent'
                  }`}
                >
                  <span className={`rounded border px-1 py-px font-mono text-[9px] font-bold ${METHOD_COLORS[ep.method]}`}>
                    {ep.method}
                  </span>
                  {ep.label}
                </button>
              ))}
            </div>

            {/* Request card */}
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="px-5 py-4 border-b">
                <div className="flex items-center gap-2.5">
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${METHOD_COLORS[selectedEndpoint.method]}`}>
                    {selectedEndpoint.method}
                  </span>
                  <code className="text-sm text-muted-foreground">{selectedEndpoint.path}</code>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{selectedEndpoint.description}</p>
              </div>

              <div className="px-5 py-4 space-y-4">
                {selectedEndpoint.hasPromptId && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      {selectedEndpoint.id.includes('tool') ? 'Tool ID' : 'Prompt ID'}
                    </label>
                    <input
                      type="text"
                      value={resourceId}
                      onChange={(e) => setResourceId(e.target.value)}
                      placeholder={selectedEndpoint.id.includes('tool') ? 'tool_xyz789' : 'prompt_abc123'}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {selectedEndpoint.hasBody && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Request Body</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={8}
                      spellCheck={false}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button onClick={handleSubmit} disabled={isLoading}>
                    {isLoading ? 'Sending...' : `Send ${selectedEndpoint.method} Request`}
                  </Button>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
              </div>
            </div>

            {/* Response */}
            {response && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Response</h2>
                <pre className="rounded-xl border bg-muted/30 p-5 font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {response}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Write with AI Modal ── */}
      {aiModalParam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAiModalParam(null)}>
          <div className="w-full max-w-sm mx-4 rounded-xl border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b">
              <h2 className="text-sm font-semibold text-foreground">Write with AI</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Generate a value for <span className="font-medium text-foreground">{aiModalParam.name}</span></p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <textarea
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateVariable(aiModalParam, aiInstruction); } }}
                placeholder="Describe what you want, e.g. &quot;A formal welcome email for a new employee&quot;"
                autoFocus
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAiModalParam(null)} className="text-xs h-8">
                  Cancel
                </Button>
                <Button
                  onClick={() => generateVariable(aiModalParam, aiInstruction)}
                  disabled={generatingVar === aiModalParam.variableId}
                  className="text-xs h-8"
                >
                  {generatingVar === aiModalParam.variableId ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Save Test Modal ── */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSaveModalOpen(false)}>
          <div className="w-full max-w-sm mx-4 rounded-xl border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b">
              <h2 className="text-sm font-semibold text-foreground">Save as Test</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Test Name</label>
                <input
                  type="text"
                  value={saveTestName}
                  onChange={(e) => setSaveTestName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveTest(); }}
                  placeholder="e.g. Welcome email - English"
                  autoFocus
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-mono">{resourceId}</span> with {filledVarCount(variableValues)}/{Object.keys(variableValues).length} variables filled
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSaveModalOpen(false)} className="text-xs h-8">
                  Cancel
                </Button>
                <Button onClick={saveTest} disabled={!saveTestName.trim()} className="text-xs h-8">
                  Save Test
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Activity Log Modal ── */}
      {logOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setLogOpen(false)}>
          <div className="w-full max-w-2xl mx-4 rounded-xl border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-sm font-semibold text-foreground">Activity Log</h2>
              <div className="flex items-center gap-3">
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setLogOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-lg leading-none"
                >
                  &times;
                </button>
              </div>
            </div>
            <div ref={logRef} className="max-h-[400px] overflow-y-auto p-5 font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-muted-foreground/40">No activity yet.</p>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="shrink-0 text-muted-foreground/40">{log.time}</span>
                      <span className={logColor(log.type)}>{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
