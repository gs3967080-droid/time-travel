import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'

import { MeshBasicMaterial } from 'three'

function GlobeFallback({ points, selectedDynasty, onPointClick, manual = false }) {
  return (
    <div className="globe-fallback">
      <div className="globe-fallback__sphere" aria-hidden="true">
        <span className="globe-fallback__longitude globe-fallback__longitude--one" />
        <span className="globe-fallback__longitude globe-fallback__longitude--two" />
        <span className="globe-fallback__latitude globe-fallback__latitude--one" />
        <span className="globe-fallback__latitude globe-fallback__latitude--two" />
      </div>
      <p className="globe-fallback__status" role="status">
        {manual ? '2D 全息视界 · 手动切换' : '3D 视界不可用 · 已启用网格地球'}
      </p>
      {points.map((point) => (
        <button
          key={point.id}
          type="button"
          className="globe-fallback__point"
          style={{
            '--point-color': point.color ?? selectedDynasty.color,
            left: `${50 + (point.lng - 105) * 1.6}%`,
            top: `${50 - (point.lat - 32) * 2.1}%`,
          }}
          aria-label={`定位${point.title}`}
          onClick={() => onPointClick(point)}
        >
          <span />
        </button>
      ))}
    </div>
  )
}

class GlobeErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

// d3-geo（react-globe.gl 底层）约定：外环顺时针、洞逆时针。
// 标准 GeoJSON 是反过来的，不修正会把大陆填充成"整个球面"。
function ringSignedArea(ring) {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return sum / 2
}

function orientRing(ring, clockwise) {
  const area = ringSignedArea(ring)
  if (area === 0) return ring
  const isClockwise = area < 0
  return isClockwise === clockwise ? ring : [...ring].reverse()
}

function normalizeWinding(features) {
  return features.map((feature) => {
    const geometry = feature.geometry
    if (!geometry) return feature
    if (geometry.type === 'Polygon') {
      return {
        ...feature,
        geometry: {
          ...geometry,
          coordinates: geometry.coordinates.map((ring, index) => orientRing(ring, index === 0)),
        },
      }
    }
    if (geometry.type === 'MultiPolygon') {
      return {
        ...feature,
        geometry: {
          ...geometry,
          coordinates: geometry.coordinates.map((polygon) =>
            polygon.map((ring, index) => orientRing(ring, index === 0)),
          ),
        },
      }
    }
    return feature
  })
}

function formatMapYear(year) {
  return year < 0 ? `公元前${Math.abs(year)}年` : `公元${year}年`
}

// 点在疆域上时，用最近的一级行政区作为落点 —— 直接点小郡块不容易命中
function nearestRegion(regions, lat, lng) {
  if (!regions.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  let best = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const feature of regions) {
    const anchor = feature.properties.anchor
    if (!Array.isArray(anchor) || anchor.length < 2) continue
    const dx = (anchor[0] - lng) * Math.cos((lat * Math.PI) / 180)
    const dy = anchor[1] - lat
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      bestDistance = distance
      best = feature
    }
  }
  return best
}

function withAlpha(hexColor, alpha) {
  if (typeof hexColor !== 'string' || !hexColor.startsWith('#') || hexColor.length !== 7) {
    return `rgba(54, 245, 230, ${alpha})`
  }
  const red = Number.parseInt(hexColor.slice(1, 3), 16)
  const green = Number.parseInt(hexColor.slice(3, 5), 16)
  const blue = Number.parseInt(hexColor.slice(5, 7), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function lightenColor(hexColor, amount = 0.45) {
  if (typeof hexColor !== 'string' || !hexColor.startsWith('#') || hexColor.length !== 7) {
    return '#c9f7f1'
  }
  const channel = (start) => {
    const value = Number.parseInt(hexColor.slice(start, start + 2), 16)
    return Math.round(value + (255 - value) * amount)
  }
  return `rgb(${channel(1)}, ${channel(3)}, ${channel(5)})`
}

export default function GlobeStage({
  points,
  selectedDynasty,
  historicalMap,
  onPointClick,
  dbStatus = 'DB · SQLite 在线',
}) {
  const globeRef = useRef(null)
  const stageRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 760, height: 680 })
  const [webglAvailable] = useState(supportsWebGL)
  const [force2D, setForce2D] = useState(false)
  const [altitude, setAltitude] = useState(1.45)
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [regionBrowserOpen, setRegionBrowserOpen] = useState(false)
  const globeMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#0b2530',
      }),
    [],
  )
  const focusEvent = selectedDynasty.events[0]
  const focusedPoint = points.find((point) => point.id === focusEvent.id)
  const mapMetadata = historicalMap.metadata
  const mapFeatures = useMemo(() => normalizeWinding(historicalMap.features), [historicalMap])
  const regionFeatures = useMemo(
    () => mapFeatures.filter((feature) => feature.properties.layer === 'region'),
    [mapFeatures],
  )
  const polityFeatures = useMemo(
    () => mapFeatures.filter((feature) => feature.properties.layer === 'polity'),
    [mapFeatures],
  )
  // 地图切换后，上一张图的选中区划对象不属于当前 features，直接视为未选中，
  // 避免切换朝代的一瞬间把旧区划叠到新地图上。
  const activeRegion =
    selectedRegion && mapFeatures.includes(selectedRegion) ? selectedRegion : null
  // 区划分界线：只画线，不再叠一层半透明区划多边形。
  // 两层多边形贴得太近会互相遮挡，切换朝代 / 选中区划时出现「空洞」。
  const regionPaths = useMemo(() => {
    const paths = []
    for (const feature of regionFeatures) {
      const geometry = feature.geometry
      if (!geometry) continue
      const polygons =
        geometry.type === 'Polygon'
          ? [geometry.coordinates]
          : geometry.type === 'MultiPolygon'
            ? geometry.coordinates
            : []
      for (const polygon of polygons) {
        for (const ring of polygon) {
          if (!Array.isArray(ring) || ring.length < 3) continue
          const selected = feature === activeRegion
          paths.push({
            region: feature,
            selected,
            // 把 selected 带进每个点，选中线才能比相邻区划的深色线略高一点，
            // 否则共享边界会被邻区的深色线盖住，看起来「没有完全包围」。
            points: ring.map(([lng, lat]) => ({ lat, lng, selected })),
          })
        }
      }
    }
    return paths
  }, [regionFeatures, activeRegion])

  const selectedAnchor = activeRegion?.properties?.anchor
  const polygonData = useMemo(
    () => (activeRegion ? [...polityFeatures, activeRegion] : polityFeatures),
    [polityFeatures, activeRegion],
  )
  const ringData = useMemo(() => {
    const rings = points.map((point) => ({ lat: point.lat, lng: point.lng, color: point.color }))
    if (Array.isArray(selectedAnchor) && selectedAnchor.length >= 2) {
      rings.push({ lat: selectedAnchor[1], lng: selectedAnchor[0], color: '#fff6db' })
    }
    return rings
  }, [points, selectedAnchor])

  useEffect(() => {
    setSelectedRegion(null)
  }, [mapMetadata.snapshotKey])

  const selectRegion = useCallback((feature) => {
    if (!feature) return
    setSelectedRegion(feature)
    const anchor = feature.properties?.anchor
    if (!Array.isArray(anchor) || anchor.length < 2) return
    if (typeof globeRef.current?.pointOfView !== 'function') return
    setAltitude(1.15)
    globeRef.current.pointOfView(
      { lat: anchor[1], lng: anchor[0], altitude: 1.15 },
      800,
    )
  }, [])

  const getFeatureColor = (feature) => {
    if (feature.properties.layer === 'region') return selectedDynasty.color
    if (feature.properties.role === 'main') return selectedDynasty.color
    return feature.properties.tint ?? '#e14c3d'
  }

  const hideReferenceGlobeLayers = () => {
    const scene = globeRef.current?.scene?.()
    if (!scene) return
    // 只保留多边形 / 点位 / 标注，隐藏所有球体（含不同版本的内部参考球）
    scene.traverse((object) => {
      if (!object.isMesh) return
      const isReferenceSphere =
        object.geometry?.type === 'SphereGeometry' && object.geometry?.parameters?.radius !== 100
      if (isReferenceSphere) {
        object.visible = false
      }
    })
  }

  const adjustMapZoom = (direction) => {
    if (typeof globeRef.current?.pointOfView !== 'function') return
    const currentView = globeRef.current.pointOfView() ?? { altitude: 1.45 }
    const nextAltitude = Math.max(0.9, Math.min(3.2, currentView.altitude + direction * 0.3))
    setAltitude(nextAltitude)
    globeRef.current.pointOfView({ altitude: nextAltitude }, 450)
  }

  const resetMapView = () => {
    if (typeof globeRef.current?.pointOfView !== 'function') return
    setAltitude(1.45)
    globeRef.current.pointOfView(
      { lat: focusEvent.lat, lng: focusEvent.lng, altitude: 1.45 },
      1000,
    )
  }

  const createMapMarker = (point) => {
    const marker = document.createElement('button')
    marker.type = 'button'
    marker.className = 'globe-marker'
    marker.setAttribute('aria-label', `星图定位${point.title}`)
    marker.style.setProperty('--marker-color', point.color)

    const location = document.createElement('strong')
    location.textContent = point.locationName
    const era = document.createElement('span')
    era.textContent = `${point.dynasty} · ${point.year}`
    marker.append(location, era)
    marker.addEventListener('click', (event) => {
      event.stopPropagation()
      onPointClick(point)
    })

    return marker
  }

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined

    const updateSize = () => {
      setDimensions({
        width: stage.clientWidth,
        height: stage.clientHeight,
      })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof globeRef.current?.pointOfView !== 'function') return
    setAltitude(1.45)
    globeRef.current.pointOfView(
      { lat: focusEvent.lat, lng: focusEvent.lng, altitude: 1.45 },
      1000,
    )
  }, [focusEvent.lat, focusEvent.lng])

  const is2D = force2D || !webglAvailable

  return (
    <section className="globe-stage" ref={stageRef} aria-label="历史坐标星图">
      <div className="globe-stage__aura" aria-hidden="true" />
      <div className="globe-stage__canvas">
        {!is2D ? (
          <GlobeErrorBoundary
            fallback={
              <GlobeFallback
                points={points}
                selectedDynasty={selectedDynasty}
                onPointClick={onPointClick}
              />
            }
          >
            <Globe
              ref={globeRef}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="#020506"
              showGraticules
              onZoom={(pov) => {
                if (Number.isFinite(pov?.altitude)) setAltitude(pov.altitude)
              }}
              globeMaterial={globeMaterial}
              onGlobeReady={hideReferenceGlobeLayers}
              polygonsData={polygonData}
              polygonAltitude={(feature) => (feature === activeRegion ? 0.0145 : 0.01)}
              polygonCapColor={(feature) => {
                if (feature === activeRegion) return lightenColor(selectedDynasty.color, 0.4)
                const isMain = feature.properties.role === 'main'
                return withAlpha(getFeatureColor(feature), isMain ? 0.5 : 0.12)
              }}
              polygonSideColor={(feature) => (
                feature === activeRegion
                  ? 'rgba(0, 0, 0, 0)'
                  : withAlpha(getFeatureColor(feature), 0.18)
              )}
              polygonStrokeColor={(feature) => (
                feature === activeRegion
                  ? 'rgba(0, 0, 0, 0)'
                  : withAlpha(getFeatureColor(feature), 1)
              )}
              polygonLabel={(feature) =>
                `${feature.properties.title}${feature.properties.category ? ` · ${feature.properties.category}` : ''}`
              }
              onPolygonClick={(feature, event, coords) => {
                if (feature === activeRegion) {
                  setSelectedRegion(null)
                  return
                }
                const fallbackAnchor = feature.properties.anchor
                const lat = Number.isFinite(coords?.lat)
                  ? coords.lat
                  : fallbackAnchor?.[1]
                const lng = Number.isFinite(coords?.lng)
                  ? coords.lng
                  : fallbackAnchor?.[0]
                selectRegion(nearestRegion(regionFeatures, lat, lng))
              }}
              polygonsTransitionDuration={0}
              pathsData={regionPaths}
              pathPoints={(path) => path.points}
              pathPointLat={(point) => point.lat}
              pathPointLng={(point) => point.lng}
              pathColor={(path) => (
                path.selected ? '#ffffff' : '#020b0e'
              )}
              pathStroke={(path) => (path.selected ? 0.65 : 0.26)}
              pathPointAlt={(point) => (point.selected ? 0.0165 : 0.0125)}
              pathResolution={1}
              pathTransitionDuration={0}
              showAtmosphere
              atmosphereColor="#36f5e6"
              atmosphereAltitude={0.14}
              pointsData={points}
              pointLat="lat"
              pointLng="lng"
              pointAltitude={0.038}
              pointRadius={0.3}
              pointColor={(point) => point.color}
              pointLabel={(point) => `${point.dynasty} · ${point.locationName} / ${point.title}`}
              onPointClick={(point) => onPointClick(point)}
              ringsData={ringData}
              ringLat="lat"
              ringLng="lng"
              ringColor={(point) => point.color}
              ringAltitude={0.07}
              ringMaxRadius={1.7}
              ringPropagationSpeed={1.7}
              ringRepeatPeriod={1700}
              htmlElementsData={activeRegion ? [] : focusedPoint ? [focusedPoint] : []}
              htmlLat="lat"
              htmlLng="lng"
              htmlAltitude={0.075}
              htmlElement={createMapMarker}
              enablePointerInteraction
            />
          </GlobeErrorBoundary>
        ) : (
          <GlobeFallback
            points={points}
            selectedDynasty={selectedDynasty}
            onPointClick={onPointClick}
            manual={force2D}
          />
        )}
      </div>

      <div className="globe-hud" aria-label="视界状态">
        <span className="globe-hud__chip">{dbStatus}</span>
        <span className="globe-hud__chip">{is2D ? '2D · 全息' : '3D · WEBGL'}</span>
        <button
          type="button"
          className="globe-hud__chip globe-hud__chip--action"
          onClick={() => setForce2D((value) => !value)}
          disabled={!webglAvailable}
          aria-pressed={force2D}
        >
          {force2D ? '切 3D' : '切 2D'}
        </button>
      </div>

      <div className="map-readout" aria-hidden="true">
        <span>HISTORICAL ADMINISTRATIVE MAP</span>
        <span>TOPOLOGY · TIME LOCK · SYNC</span>
      </div>

      <div
        className="historical-map-meta"
        data-testid="historical-map-meta"
        data-year={mapMetadata.year}
      >
        <span>{mapMetadata.dynasty}历史地图</span>
        <strong>
          {formatMapYear(mapMetadata.year)} · {mapMetadata.regionCount}
          {mapMetadata.subdivisionLabel}
        </strong>
        <small>
          {polityFeatures.map((feature) => feature.properties.title).join(' / ')}
        </small>
        <em>边界示意 · 江山时序 Jiangshan Atlas</em>
      </div>

      <div className="map-controls" aria-label="星图视角控制">
        <button type="button" aria-label="放大星图" onClick={() => adjustMapZoom(-1)}>
          +
        </button>
        <button type="button" aria-label="缩小星图" onClick={() => adjustMapZoom(1)}>
          −
        </button>
        <button type="button" aria-label="复位星图" onClick={resetMapView}>
          <span aria-hidden="true">◎</span>
        </button>
        <button
          type="button"
          aria-label="查看区划列表"
          aria-pressed={regionBrowserOpen}
          onClick={() => setRegionBrowserOpen((value) => !value)}
        >
          <span aria-hidden="true">区</span>
        </button>
      </div>

      <div className="globe-stage__coordinates" aria-live="polite">
        <span>观测坐标</span>
        <strong>
          {selectedDynasty.dynasty} · {focusEvent.locationName}
        </strong>
        <small>
          {Math.abs(focusEvent.lat).toFixed(2)}°N / {Math.abs(focusEvent.lng).toFixed(2)}°E ·{' '}
          {formatMapYear(focusEvent.year)}
        </small>
      </div>

      <div
        className={`region-readout ${activeRegion ? 'is-active' : ''}`}
        data-testid="selected-region"
        aria-live="polite"
      >
        {activeRegion ? (
          <>
            <span>{activeRegion.properties.category}</span>
            <strong>{activeRegion.properties.title}</strong>
            <button
              type="button"
              className="region-readout__more"
              onClick={() => setRegionBrowserOpen(true)}
            >
              查看全部 {regionFeatures.length} {mapMetadata.subdivisionLabel} ›
            </button>
            <button
              type="button"
              className="region-readout__more"
              onClick={() => setSelectedRegion(null)}
            >
              清除选区
            </button>
          </>
        ) : (
          <>
            <span>一级行政区</span>
            <strong>点击地图色块查看 {regionFeatures.length} 个区划</strong>
            <button
              type="button"
              className="region-readout__more"
              onClick={() => setRegionBrowserOpen(true)}
            >
              展开区划列表 ›
            </button>
          </>
        )}
      </div>

      {regionBrowserOpen ? (
        <div className="region-browser" aria-label="历史区划列表">
          <header>
            <span>
              {mapMetadata.dynasty} · {regionFeatures.length}
              {mapMetadata.subdivisionLabel}
            </span>
            <button
              type="button"
              aria-label="关闭区划列表"
              onClick={() => setRegionBrowserOpen(false)}
            >
              ×
            </button>
          </header>
          <div className="region-browser__list thin-scrollbar">
            {regionFeatures.map((feature) => (
              <button
                key={feature.properties.title}
                type="button"
                className={feature === activeRegion ? 'is-active' : ''}
                onClick={() => selectRegion(feature)}
              >
                <span>{feature.properties.title}</span>
                <small>{feature.properties.category}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="globe-stage__legend" aria-hidden="true">
        <span />
        <p>历史边界为示意性复原 · {mapMetadata.source}</p>
      </div>

      <p className="globe-stage__alt" aria-hidden="true">
        {Math.abs(focusEvent.lng).toFixed(2)} · ALT {altitude.toFixed(2)}
      </p>

      <p className="globe-stage__drag" aria-hidden="true">
        DRAG TO ROTATE · SCROLL TO ZOOM
      </p>
    </section>
  )
}

