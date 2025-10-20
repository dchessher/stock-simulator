import { useEffect, useMemo, useState } from 'react'
import './App.css'

type StockPoint = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type StockData = {
  ticker: string
  data: StockPoint[]
}

type RangeKey =
  | '1D'
  | '2D'
  | '5D'
  | '10D'
  | '1M'
  | '3M'
  | '6M'
  | '1Y'
  | 'MAX'

const RANGE_MAP: Record<RangeKey, number | 'ALL'> = {
  '1D': 1,
  '2D': 2,
  '5D': 5,
  '10D': 10,
  '1M': 22,
  '3M': 66,
  '6M': 'ALL',
  '1Y': 'ALL',
  MAX: 'ALL'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatPercent(value: number) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function StockChart({ data }: { data: StockPoint[] }) {
  if (data.length === 0) {
    return <div className="chart-placeholder">No data</div>
  }

  const padding = 16
  const width = 640
  const height = 280
  const minPrice = Math.min(...data.map((d) => d.low))
  const maxPrice = Math.max(...data.map((d) => d.high))
  const priceRange = maxPrice - minPrice || 1
  const chartPoints = data.map((point, index) => {
    const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((point.close - minPrice) / priceRange) * (height - padding * 2)
    return { x, y, point }
  })
  const points = chartPoints.map(({ x, y }) => `${x},${y}`).join(' ')

  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const hoveredPoint = hoverIndex !== null ? chartPoints[hoverIndex] : null
  const tooltipConfig = (() => {
    if (!hoveredPoint) return null
    const tooltipWidth = 180
    const tooltipHeight = 70
    let tooltipX = hoveredPoint.x - tooltipWidth / 2
    tooltipX = Math.max(padding, Math.min(tooltipX, width - padding - tooltipWidth))
    let tooltipY = hoveredPoint.y - tooltipHeight - 12
    if (tooltipY < padding) {
      tooltipY = hoveredPoint.y + 12
    }
    const dateLabel = new Date(hoveredPoint.point.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    return { tooltipX, tooltipY, tooltipWidth, tooltipHeight, dateLabel }
  })()

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!chartPoints.length) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const scaleX = width / bounds.width
    const pointerX = (event.clientX - bounds.left) * scaleX
    const ratio = (pointerX - padding) / (width - padding * 2)
    const clampedRatio = Math.min(1, Math.max(0, ratio))
    const index = Math.round(clampedRatio * (chartPoints.length - 1))
    setHoverIndex(index)
  }

  const handleMouseLeave = () => {
    setHoverIndex(null)
  }

  return (
    <svg
      className="stock-chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(76, 175, 80, 0.3)" />
          <stop offset="100%" stopColor="rgba(76, 175, 80, 0)" />
        </linearGradient>
      </defs>
      <polyline className="chart-line" points={points} />
      <polygon
        className="chart-area"
        points={`${padding},${height - padding} ${points} ${
          width - padding
        },${height - padding}`}
      />
      <line
        className="chart-baseline"
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
      />
      {hoveredPoint && tooltipConfig ? (
        <g key={hoverIndex ?? undefined}>
          <line
            className="chart-hover-line"
            x1={hoveredPoint.x}
            y1={padding}
            x2={hoveredPoint.x}
            y2={height - padding}
          />
          <circle className="chart-hover-dot" cx={hoveredPoint.x} cy={hoveredPoint.y} r={5} />
          <g className="chart-tooltip" transform={`translate(${tooltipConfig.tooltipX}, ${tooltipConfig.tooltipY})`}>
            <rect
              className="chart-tooltip-box"
              width={tooltipConfig.tooltipWidth}
              height={tooltipConfig.tooltipHeight}
              rx={10}
            />
            <text className="chart-tooltip-date" x={16} y={24}>
              {tooltipConfig.dateLabel}
            </text>
            <text className="chart-tooltip-label" x={16} y={42}>
              High
            </text>
            <text className="chart-tooltip-value" x={tooltipConfig.tooltipWidth - 16} y={42} textAnchor="end">
              {formatCurrency(hoveredPoint.point.high)}
            </text>
            <text className="chart-tooltip-label" x={16} y={60}>
              Low
            </text>
            <text className="chart-tooltip-value" x={tooltipConfig.tooltipWidth - 16} y={60} textAnchor="end">
              {formatCurrency(hoveredPoint.point.low)}
            </text>
          </g>
        </g>
      ) : null}
    </svg>
  )
}

function Indicator({ slope }: { slope: number }) {
  const trend = slope > 0.2 ? 'Bullish' : slope < -0.2 ? 'Bearish' : 'Neutral'
  return (
    <div className={`indicator ${trend.toLowerCase()}`}>
      <span className="indicator-label">Market sentiment</span>
      <span className="indicator-value">{trend}</span>
    </div>
  )
}

function App() {
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [selectedRange, setSelectedRange] = useState<RangeKey>('6M')

  useEffect(() => {
    fetch('/data/one.json')
      .then((response) => response.json())
      .then((data: StockData) => {
        const parsed = {
          ...data,
          data: data.data.map((point) => ({
            ...point,
            close: Number(point.close),
            high: Number(point.high),
            low: Number(point.low),
            open: Number(point.open),
            volume: Number(point.volume)
          }))
        }
        setStockData(parsed)
      })
      .catch((error) => {
        console.error('Failed to load stock data', error)
      })
  }, [])

  const filteredData = useMemo(() => {
    if (!stockData) return []
    const range = RANGE_MAP[selectedRange]
    if (range === 'ALL') {
      return stockData.data
    }
    return stockData.data.slice(-range)
  }, [stockData, selectedRange])

  const latestPoint = filteredData.at(-1) ?? stockData?.data.at(-1)
  const previousPoint = stockData?.data.at(-2)
  const currentPrice = latestPoint?.close ?? 0
  const previousClose = previousPoint?.close ?? currentPrice
  const priceChange = currentPrice - previousClose
  const priceChangePercent = previousClose ? (priceChange / previousClose) * 100 : 0
  const averageVolume = useMemo(() => {
    if (!filteredData.length) return 0
    return filteredData.reduce((sum, point) => sum + point.volume, 0) / filteredData.length
  }, [filteredData])

  const slope = useMemo(() => {
    if (filteredData.length < 2) return 0
    const first = filteredData[0].close
    const last = filteredData[filteredData.length - 1].close
    return ((last - first) / first) * 100
  }, [filteredData])

  const position = useMemo(() => {
    const shares = 120
    const costBasis = 108.5
    const marketValue = shares * currentPrice
    const totalCost = shares * costBasis
    const unrealizedGain = marketValue - totalCost
    const gainPercent = totalCost ? (unrealizedGain / totalCost) * 100 : 0
    return {
      shares,
      costBasis,
      marketValue,
      unrealizedGain,
      gainPercent
    }
  }, [currentPrice])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>ONE</h1>
          <p className="subtitle">Fictional Technologies Inc.</p>
        </div>
        <div className="price-block">
          <div className="price">{formatCurrency(currentPrice)}</div>
          <div className={`price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(priceChange)} ({formatPercent(priceChangePercent)})
          </div>
        </div>
      </header>

      <section className="chart-section">
        <div className="range-controls">
          {(Object.keys(RANGE_MAP) as RangeKey[]).map((range) => (
            <button
              key={range}
              className={range === selectedRange ? 'active' : ''}
              onClick={() => setSelectedRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
        <StockChart data={filteredData} />
      </section>

      <section className="info-grid">
        <div className="panel stats">
          <h2>Stock statistics</h2>
          <div className="stat-row">
            <span>Open</span>
            <span>{formatCurrency(latestPoint?.open ?? 0)}</span>
          </div>
          <div className="stat-row">
            <span>High</span>
            <span>{formatCurrency(latestPoint?.high ?? 0)}</span>
          </div>
          <div className="stat-row">
            <span>Low</span>
            <span>{formatCurrency(latestPoint?.low ?? 0)}</span>
          </div>
          <div className="stat-row">
            <span>Volume</span>
            <span>{formatNumber(latestPoint?.volume ?? 0)}</span>
          </div>
          <div className="stat-row">
            <span>Average volume ({selectedRange})</span>
            <span>{formatNumber(Math.round(averageVolume))}</span>
          </div>
        </div>

        <div className="panel position">
          <h2>Position details</h2>
          <div className="stat-row">
            <span>Shares</span>
            <span>{position.shares}</span>
          </div>
          <div className="stat-row">
            <span>Average cost</span>
            <span>{formatCurrency(position.costBasis)}</span>
          </div>
          <div className="stat-row">
            <span>Market value</span>
            <span>{formatCurrency(position.marketValue)}</span>
          </div>
          <div className="stat-row">
            <span>Unrealized gain</span>
            <span className={position.unrealizedGain >= 0 ? 'positive' : 'negative'}>
              {formatCurrency(position.unrealizedGain)} ({formatPercent(position.gainPercent)})
            </span>
          </div>
        </div>

        <div className="panel sentiment">
          <h2>Trend indicator</h2>
          <Indicator slope={slope} />
          <p className="indicator-description">
            Sentiment is calculated from the percentage change across the selected range. Switch
            ranges to explore how momentum shifts over time.
          </p>
        </div>
      </section>
    </div>
  )
}

export default App
