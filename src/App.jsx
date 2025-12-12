import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import staticCifManifest from './cifManifest.json'

const envelopeFields = [
  { key: 'temperature', label: 'Temperature', min: -20, max: 180, unit: '°C' },
  { key: 'humidity', label: 'Humidity', min: 0, max: 100, unit: '%' },
  { key: 'sunlight', label: 'Sunlight Exposure', min: 0, max: 24, unit: 'hrs/day' },
  { key: 'acidity', label: 'Acidity', min: 0, max: 14, unit: 'pH' },
  { key: 'pressure', label: 'Pressure', min: 1, max: 100, unit: ' bar' },
  { key: 'salinity', label: 'Salinity', min: 0, max: 100000, unit: ' ppm' },
  { key: 'impurities', label: 'Impurity load', min: 0, max: 1000, unit: ' ppm' },
  { key: 'duration', label: 'Duration', min: 100, max: 10000, unit: ' cycles' },
]

const kpiOptions = [
  { key: 'co2_henry', label: 'CO₂ Henry coefficient' },
  { key: 'h2_diff', label: 'H₂ diffusivity' },
  { key: 'h2_uptake', label: 'H₂ uptake' },
  { key: 'o2_uptake', label: 'O₂ uptake' },
  { key: 'o2_diff', label: 'O₂ diffusivity' },
  { key: 'co2_n2_selectivity', label: 'CO₂/N₂ selectivity' },
  { key: 'h2_ch4_selectivity', label: 'H₂/CH₄ selectivity' },
  { key: 'water_flux', label: 'Water flux / permeance' },
  { key: 'salt_rejection', label: 'Salt rejection rate' },
  { key: 'qst', label: 'Isosteric heat of adsorption (Qₛₜ)' },
  { key: 'bulk_modulus', label: 'Bulk/Shear modulus' },
  { key: 'td', label: 'Thermal decomposition (Tₙ)' },
  { key: 'band_gap', label: 'Electronic band gap' },
]

const fallbackCifs = [
  { name: 'Aurora Hex COF', path: '/cifs/aurora_hex.cif', note: 'Hexagonal pores tuned for mixed-gas separation.', source: 'bundled' },
  { name: 'Atlas Grid COF', path: '/cifs/atlas_grid.cif', note: 'Square channels to benchmark uptake kinetics.', source: 'bundled' },
  { name: 'Nautilus Channel COF', path: '/cifs/nautilus_channel.cif', note: '1D channels to probe diffusivity and stability.', source: 'bundled' },
]

const TopIcon = ({ children }) => (
  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
    {children}
  </span>
)

function App() {
  const [envelope, setEnvelope] = useState({
    temperature: 65,
    humidity: 55,
    sunlight: 8,
    acidity: 7,
    pressure: 20,
    salinity: 35000,
    impurities: 50,
    duration: 1000,
  })
  const [saveName, setSaveName] = useState('desert-prototype')
  const [operationContext, setOperationContext] = useState('')
  const [selectedKpis, setSelectedKpis] = useState(['co2_henry', 'h2_diff'])

  const [cifList, setCifList] = useState(fallbackCifs)
  const [cifLoading, setCifLoading] = useState(true)
  const [cifError, setCifError] = useState('')
  const [activeCif, setActiveCif] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [generateMessage, setGenerateMessage] = useState('')
  const generateAbortRef = useRef(null)
  const [apiAvailable, setApiAvailable] = useState(true)

  const [unitCellVisible, setUnitCellVisible] = useState(true)
  const [supercell, setSupercell] = useState(2)

  const [currentFileData, setCurrentFileData] = useState('')
  const [currentExt, setCurrentExt] = useState('cif')

  const [isScriptReady, setIsScriptReady] = useState(false)
  const [isViewerReady, setIsViewerReady] = useState(false)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [viewerError, setViewerError] = useState('')

  const containerRef = useRef(null)
  const viewerRef = useRef(null)

  const staticCifs = useMemo(() => (Array.isArray(staticCifManifest) ? staticCifManifest : []), [])

  const applyCifList = useCallback((list, preferredPath) => {
    setCifList(list)
    setActiveCif((prev) => {
      if (preferredPath) {
        const matchIdx = list.findIndex((f) => f.path === preferredPath)
        if (matchIdx >= 0) return matchIdx
      }
      return prev < list.length ? prev : 0
    })
  }, [])

  const loadStaticCifs = useCallback(
    (preferredPath) => {
      const list = staticCifs.length > 0 ? staticCifs : fallbackCifs
      applyCifList(list, preferredPath)
      if (!list.length) {
        setCifError('No CIFs bundled with this build.')
      } else {
        setCifError('Backend API unavailable. Using bundled CIFs.')
      }
    },
    [applyCifList, staticCifs],
  )

  const fetchCifs = useCallback(
    async (preferredPath) => {
      setCifLoading(true)
      setCifError('')
      if (!apiAvailable) {
        loadStaticCifs(preferredPath)
        setCifLoading(false)
        return
      }
      try {
        const res = await fetch('/api/cifs', { cache: 'no-store' })
        if (!res.ok) throw new Error('Request failed')
        const data = await res.json()
        const files = Array.isArray(data?.files)
          ? data.files.filter((f) => f?.path?.toLowerCase().endsWith('.cif'))
          : []

        const effectiveList = files.length > 0 ? files : staticCifs.length > 0 ? staticCifs : fallbackCifs

        applyCifList(effectiveList, preferredPath)
        setApiAvailable(true)

        if (files.length === 0) {
          setCifError('No CIFs found via API. Using bundled CIFs.')
        }
      } catch (error) {
        console.error('Failed to list CIFs', error)
        setApiAvailable(false)
        loadStaticCifs(preferredPath)
      } finally {
        setCifLoading(false)
      }
    },
    [apiAvailable, applyCifList, loadStaticCifs, staticCifs],
  )

  const handleCreateCof = useCallback(async () => {
    if (!apiAvailable) {
      setGenerateError('Generator API is not available in this static build.')
      setGenerateMessage('')
      return
    }

    if (isGenerating && generateAbortRef.current) {
      generateAbortRef.current.abort()
      setGenerateError('Generation cancelled.')
      setGenerateMessage('')
      setIsGenerating(false)
      return
    }

    const controller = new AbortController()
    generateAbortRef.current = controller
    setIsGenerating(true)
    setGenerateError('')
    setGenerateMessage('')
    try {
      const res = await fetch('/api/generate-cof', { method: 'POST', signal: controller.signal })
      let data = null
      try {
        data = await res.json()
      } catch (err) {
        data = null
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to generate COF.')
      }
      if (!data?.file?.path) {
        throw new Error(data?.error || 'Generator returned no file.')
      }

      setGenerateMessage(`Created ${data.file.name}`)
      await fetchCifs(data.file.path)
    } catch (error) {
      if (error.name === 'AbortError') {
        setGenerateError('Generation cancelled.')
      } else {
        console.error('Failed to generate COF', error)
        setGenerateError(error.message || 'Could not generate a COF. Check server logs.')
      }
    } finally {
      setIsGenerating(false)
      generateAbortRef.current = null
    }
  }, [apiAvailable, fetchCifs, isGenerating])

  useEffect(() => {
    fetchCifs()
  }, [fetchCifs])

  // Load 3Dmol.js script dynamically from CDN
  useEffect(() => {
    if (typeof window !== 'undefined' && window.$3Dmol) {
      setIsScriptReady(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.0.4/3Dmol-min.js'
    script.async = true
    script.onload = () => setIsScriptReady(true)
    script.onerror = () => setViewerError('Could not load the 3Dmol viewer library.')
    document.body.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  // Initialize viewer once 3Dmol is available
  useEffect(() => {
    if (!isScriptReady || !containerRef.current || viewerRef.current) return
    if (!window?.$3Dmol) return

    const viewer = window.$3Dmol.createViewer(containerRef.current, {
      backgroundColor: '#050c0a',
    })

    viewerRef.current = viewer
    setIsViewerReady(true)

    const handleResize = () => viewer.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      viewerRef.current = null
    }
  }, [isScriptReady])

  const renderCurrentData = useCallback(
    (data, ext) => {
      if (!viewerRef.current || !data) return
      setIsLoadingFile(true)
      setViewerError('')

      try {
        const viewer = viewerRef.current
        viewer.clear()
        viewer.removeAllShapes()

        viewer.addModel(data, ext || 'cif')
        viewer.setStyle({}, { stick: { radius: 0.15, color: '#b6ffe5' }, sphere: { scale: 0.23 } })

        if ((ext || 'cif') === 'cif') {
          if (unitCellVisible) viewer.addUnitCell()
          if (supercell > 1) viewer.replicateUnitCell(supercell, supercell, supercell)
        }

        viewer.zoomTo()
        viewer.render()
      } catch (error) {
        console.error('Failed to render CIF', error)
        setViewerError('Could not render the CIF. Verify the file content and try again.')
      } finally {
        setIsLoadingFile(false)
      }
    },
    [supercell, unitCellVisible],
  )

  const loadCif = useCallback(
    async (fileObj) => {
      if (!fileObj || !viewerRef.current) return
      setIsLoadingFile(true)
      setViewerError('')

      try {
        const res = await fetch(fileObj.path, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed to fetch ${fileObj.path}`)
        const text = await res.text()
        const ext = fileObj.path.split('.').pop()?.toLowerCase() || 'cif'

        setCurrentFileData(text)
        setCurrentExt(ext)
        renderCurrentData(text, ext)
      } catch (error) {
        console.error('Failed to load CIF', error)
        setViewerError('Could not load the CIF file. Check that it exists and is readable.')
      } finally {
        setIsLoadingFile(false)
      }
    },
    [renderCurrentData],
  )

  // Load initial/active file once viewer is ready
  useEffect(() => {
    if (isViewerReady && cifList[activeCif]) {
      loadCif(cifList[activeCif])
    }
  }, [activeCif, isViewerReady, cifList, loadCif])

  // Re-render current data when supercell or unit cell toggles change
  useEffect(() => {
    if (isViewerReady && currentFileData) {
      renderCurrentData(currentFileData, currentExt)
    }
  }, [supercell, unitCellVisible, isViewerReady, currentFileData, currentExt, renderCurrentData])

  const toggleKpi = (key) => {
    setSelectedKpis((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const handleEnvelopeChange = (key, value) => {
    setEnvelope((prev) => ({ ...prev, [key]: value }))
  }

  const activeFile = cifList[activeCif]

  return (
    <div className="min-h-screen text-slate-100">
      <div className="grid-lines pointer-events-none fixed inset-0 opacity-60" />
      <header className="sticky top-0 z-20 border-b border-stroke/60 bg-charcoal/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-500/80 via-emerald-400/60 to-emerald-300/70 p-[2px] shadow-glow">
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-charcoal text-lg font-semibold text-emerald-200">COF</div>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.16em] text-emerald-200/80">Live Prototype</p>
              <p className="text-base font-semibold text-white">Environment-aware COF Explorer</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center gap-3">
              <button className="button-soft flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-white/10 hover:bg-white/10">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3v13" />
                  <path d="M6 12l6 6 6-6" />
                  <path d="M4 21h16" />
                </svg>
                Export snapshot
              </button>
              <button
                onClick={handleCreateCof}
                disabled={!apiAvailable}
                className={`button-soft flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-emerald-950 shadow-glow transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isGenerating ? 'bg-rose-400 hover:bg-rose-300' : 'bg-emerald-400 hover:bg-emerald-300'
                }`}
              >
                {isGenerating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-900 border-t-white" />
                    Cancel
                  </>
                ) : apiAvailable ? (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M12 3v18" />
                      <path d="M3 12h18" />
                    </svg>
                    Create COF
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M4 12h16" />
                      <path d="M12 4v16" />
                    </svg>
                    Backend offline
                  </>
                )}
              </button>
              <button onClick={() => fetchCifs()} className="button-soft flex items-center gap-2 rounded-xl bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-glow hover:bg-emerald-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12h8M12 8v8" />
                </svg>
                Rescan files
              </button>
            </div>
            {(generateError || generateMessage) && (
              <p className={`text-xs ${generateError ? 'text-rose-200' : 'text-emerald-200'}`}>
                {generateError || generateMessage}
              </p>
            )}
            {!apiAvailable && (
              <p className="text-xs text-amber-200">
                Running in static mode (no backend). Using bundled CIFs; generator is disabled.
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 lg:flex-row">
        <aside className="w-full max-w-[320px] flex-shrink-0 space-y-6 rounded-3xl border border-stroke/70 bg-panel/80 p-5 shadow-glow backdrop-blur lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-200/80">Operating envelope</p>
              <p className="text-lg font-semibold text-white">Set environment</p>
            </div>
            <TopIcon>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 12c4-6 12-6 16 0" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </TopIcon>
          </div>

          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {envelopeFields.map((item) => (
              <div key={item.key} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/5">
                <div className="flex items-center justify-between text-sm text-slate-200/80">
                  <span>{item.label}</span>
                  <span className="font-semibold text-emerald-200">
                    {envelope[item.key]}
                    {item.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={item.min}
                  max={item.max}
                  value={envelope[item.key]}
                  onChange={(e) => handleEnvelopeChange(item.key, Number(e.target.value))}
                  className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-stroke/60 accent-emerald-400"
                />
                <div className="mt-1 flex justify-between text-[11px] uppercase tracking-widest text-slate-400">
                  <span>{item.min + item.unit}</span>
                  <span>{item.max + item.unit}</span>
                </div>
                {item.key === 'salinity' && (
                  <p className="mt-2 text-[11px] text-emerald-100/80">High salinity → test desal durability.</p>
                )}
                {item.key === 'pressure' && (
                  <p className="mt-2 text-[11px] text-emerald-100/80">Higher pressure → shift uptake/isotherms.</p>
                )}
                {item.key === 'impurities' && (
                  <p className="mt-2 text-[11px] text-emerald-100/80">Trace poisons can block binding sites.</p>
                )}
                {item.key === 'duration' && (
                  <p className="mt-2 text-[11px] text-emerald-100/80">Cycle count for degradation horizon.</p>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/5">
            <div className="flex items-center justify-between text-sm text-slate-200/80">
              <span>Output name</span>
              <span className="text-[11px] uppercase tracking-widest text-emerald-200/80">*.cif</span>
            </div>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="w-full rounded-xl border border-stroke/70 bg-charcoal px-3 py-2 text-sm font-medium text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              placeholder="cof-structure"
            />
            <button className="button-soft w-full rounded-xl bg-emerald-500/80 px-3 py-2 text-sm font-semibold text-emerald-950 shadow-glow hover:bg-emerald-400">
              Save .cif preset
            </button>
          </div>

          <div className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-200/80">Additional Qualitative Operation Context</span>
              <span className="text-[11px] uppercase tracking-widest text-emerald-200/80">notes</span>
            </div>
            <textarea
              value={operationContext}
              onChange={(e) => setOperationContext(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-stroke/70 bg-charcoal px-3 py-2 text-sm font-medium text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              placeholder="e.g., fouling history, preferred solvents, test caveats"
            />
            <p className="text-[11px] text-slate-400">
              Capture non-numeric context the generator should consider (operation quirks, sample history, constraints).
            </p>
          </div>

          <div className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-200/80">KPIs to prioritise</span>
              <span className="text-[11px] uppercase tracking-widest text-emerald-200/80">multi-select</span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[320px] overflow-y-auto pr-1">
              {kpiOptions.map((kpi) => {
                const active = selectedKpis.includes(kpi.key)
                return (
                  <button
                    key={kpi.key}
                    onClick={() => toggleKpi(kpi.key)}
                    className={`button-soft rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? 'border-emerald-300/70 bg-emerald-500/15 text-emerald-100'
                        : 'border-stroke/60 bg-white/5 text-slate-300 hover:border-emerald-400/50'
                    }`}
                  >
                    {kpi.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-100 ring-1 ring-emerald-400/30">
            <p className="font-semibold">AI coupling coming next</p>
            <p className="mt-1 text-slate-200/80">
              Sliders and KPIs are ready. Hook this panel to your generative model or API when the recommender is live.
            </p>
          </div>
        </aside>

        <section className="flex-1 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="glass-panel glow-border relative overflow-hidden rounded-2xl p-4">
              <p className="text-sm text-emerald-100">Selected CIF</p>
              <p className="mt-1 text-xl font-semibold text-white">{activeFile?.name || 'None selected'}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {activeFile?.source && (
                  <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                    {activeFile.source === 'generated'
                      ? 'generated_cofs'
                      : activeFile.source === 'library'
                        ? '/public/cifs'
                        : activeFile.source}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {activeFile?.note || 'Drop .cif files into /public/cifs or hit Create COF to add new ones.'}
              </p>
              <div className="mt-4 rounded-xl border border-emerald-400/20 bg-charcoal/60 px-3 py-2 text-xs text-emerald-100">
                <p className="font-semibold uppercase tracking-wide text-emerald-200/80">Directory</p>
                <p className="mt-1 font-mono text-[13px] text-slate-100">{activeFile?.path || 'No file loaded'}</p>
              </div>
              {cifError && <p className="mt-3 text-xs text-amber-300/90">{cifError}</p>}
            </div>
            <div className="glass-panel glow-border relative overflow-hidden rounded-2xl p-4">
              <p className="text-sm text-emerald-100">Operating setpoint</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-200/90">
                {envelopeFields.map((field) => (
                  <div key={field.key} className="rounded-xl border border-stroke/60 bg-white/5 px-3 py-2">
                    <p className="text-[12px] uppercase tracking-wide text-emerald-200/70">{field.label}</p>
                    <p className="text-lg font-semibold text-white">
                      {envelope[field.key]}
                      <span className="ml-1 text-xs text-slate-300">{field.unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-panel glow-border relative overflow-hidden rounded-2xl p-4">
              <p className="text-sm text-emerald-100">KPI focus</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedKpis.length ? (
                  selectedKpis.map((kpi) => {
                    const label = kpiOptions.find((k) => k.key === kpi)?.label
                    return (
                      <span
                        key={kpi}
                        className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-400/40"
                      >
                        {label}
                      </span>
                    )
                  })
                ) : (
                  <span className="text-sm text-slate-300">No KPIs selected</span>
                )}
              </div>
              <div className="mt-4 rounded-xl border border-stroke/60 bg-white/5 px-3 py-2 text-xs text-slate-200/80">
                Configure KPIs now; wire to scoring logic when ready.
              </div>
            </div>
          </div>

          <div className="glass-panel glow-border relative h-[520px] overflow-hidden rounded-3xl border border-stroke/70">
            <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-3 rounded-xl bg-charcoal/70 px-3 py-2 text-sm text-emerald-100 ring-1 ring-white/10">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <span>Live CIF viewport (3Dmol)</span>
              <button
                onClick={() => {
                  if (viewerRef.current) viewerRef.current.zoomTo()
                }}
                className="button-soft rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs text-white hover:border-emerald-400/60"
              >
                Reset view
              </button>
              <button
                onClick={() => setUnitCellVisible((v) => !v)}
                className={`button-soft rounded-lg border px-3 py-1 text-xs ${
                  unitCellVisible
                    ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/10 bg-white/10 text-slate-200'
                }`}
              >
                {unitCellVisible ? 'Hide unit cell' : 'Show unit cell'}
              </button>
              <label className="flex items-center gap-2 text-xs text-slate-200">
                Supercell
                <select
                  value={supercell}
                  onChange={(e) => setSupercell(Number(e.target.value))}
                  className="rounded-lg border border-white/10 bg-charcoal px-2 py-1 text-xs text-white focus:border-emerald-400 focus:outline-none"
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}x{n}x{n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div ref={containerRef} className="h-full w-full" />

            {(isLoadingFile || isGenerating) && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70">
                <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-sm text-emerald-100 ring-1 ring-emerald-400/30">
                  <span className="h-3 w-3 animate-ping rounded-full bg-emerald-300" />
                  {isGenerating ? 'Generating COF...' : 'Loading structure...'}
                </div>
              </div>
            )}

            {viewerError && (
              <div className="absolute inset-x-6 bottom-6 rounded-xl border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {viewerError}
              </div>
            )}

            {!activeFile && !isLoadingFile && (
              <div className="absolute inset-0 flex items-center justify-center bg-charcoal/60 text-sm text-slate-200">
                No CIF files available. Drop .cif files into /public/cifs, create one, and hit Rescan.
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="glass-panel glow-border rounded-2xl p-4">
              <div className="flex items-center justify-between text-sm text-emerald-100">
                <p>Available CIFs</p>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100 ring-1 ring-emerald-400/30">
                  {cifList.length} files
                </span>
              </div>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {cifLoading && <p className="text-xs text-slate-300">Scanning directory...</p>}
                {!cifLoading && cifList.length === 0 && (
                  <p className="text-xs text-slate-300">No files found. Drop .cif files into /public/cifs or generate a new one.</p>
                )}
                {cifList.map((file, idx) => (
                  <button
                    key={file.path}
                    onClick={() => setActiveCif(idx)}
                    className={`button-soft flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                      idx === activeCif
                        ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                        : 'border-stroke/60 bg-white/5 text-slate-200 hover:border-emerald-400/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{file.name || file.path.split('/').pop()}</p>
                        {file.source && (
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
                            {file.source === 'generated' ? 'generated' : file.source === 'library' ? 'cifs' : file.source}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{file.path}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-emerald-200/80">Select</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-panel glow-border rounded-2xl p-4">
              <p className="text-sm text-emerald-100">Viewer status</p>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-stroke/60 bg-white/5 px-3 py-2 text-sm text-slate-200/90">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    viewerError ? 'bg-rose-400' : isLoadingFile ? 'bg-amber-300' : isViewerReady ? 'bg-emerald-400' : 'bg-slate-400'
                  }`}
                />
                {viewerError
                  ? 'Issue loading CIF'
                  : isLoadingFile
                    ? 'Loading structure...'
                    : isViewerReady
                      ? 'Ready'
                      : 'Initializing viewer...'}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Using 3Dmol for CIF rendering. Rescan picks up any new files added to /public/cifs or generated_cofs. Toggle the unit cell
                or expand the supercell to inspect pore geometry.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
