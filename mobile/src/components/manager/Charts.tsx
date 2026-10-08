import React, { useState } from 'react';
import { StyleSheet, Text, View, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, G } from 'react-native-svg';

const burgundy = '#801D26';
const lightBurgundy = '#F9EBEF';
const blue = '#2E90FA';
const orange = '#F79009';
const green = '#0E9384';
const gold = '#F4D06F';

// Helper to generate smooth Catmull-Rom cubic bezier SVG paths
function getSmoothCurveAndArea(
  points: { x: number; y: number }[],
  bottomY: number
): { curvePath: string; areaPath: string } {
  if (!points || points.length === 0) return { curvePath: '', areaPath: '' };
  if (points.length === 1) {
    return {
      curvePath: `M ${points[0].x} ${points[0].y}`,
      areaPath: `M ${points[0].x} ${points[0].y} L ${points[0].x} ${bottomY} Z`,
    };
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const areaD = `${d} L ${last.x.toFixed(1)} ${bottomY.toFixed(1)} L ${first.x.toFixed(1)} ${bottomY.toFixed(1)} Z`;

  return { curvePath: d, areaPath: areaD };
}

// 1. Occupancy Trend Curve for Dashboard (Smooth SVG Bezier Curve)
export function OccupancyTrendChart({
  peakLabel = '82%',
  data,
}: {
  peakLabel?: string;
  data?: { hour: string; value: number; isPeak?: boolean }[];
}) {
  const [plotWidth, setPlotWidth] = useState(260);

  const points = data && data.length > 0 ? data : [
    { hour: '12 PM', value: 1 },
    { hour: '2 PM', value: 3 },
    { hour: '4 PM', value: 3 },
    { hour: '6 PM', value: 5 },
    { hour: '8 PM', value: 8, isPeak: true },
    { hour: '10 PM', value: 6 },
  ];
  const maxVal = Math.max(10, ...points.map((p) => p.value));
  const plotHeight = 110;
  const paddingHoriz = 12;

  const onPlotLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 50 && Math.abs(w - plotWidth) > 2) {
      setPlotWidth(w);
    }
  };

  const coords = points.map((p, i) => {
    const x =
      paddingHoriz +
      (i / Math.max(1, points.length - 1)) * (plotWidth - paddingHoriz * 2);
    const y = Math.max(
      16,
      plotHeight - 8 - (p.value / maxVal) * (plotHeight - 28)
    );
    return { ...p, x, y };
  });

  const { curvePath, areaPath } = getSmoothCurveAndArea(coords, plotHeight);
  const peakCoord = coords.find((c) => c.isPeak) || coords[coords.length - 2];

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartCardTitle}>Occupancy Trend</Text>
      <View style={[styles.chartContainer, { height: plotHeight + 35, marginTop: 14 }]}>
        {/* Y Axis */}
        <View style={styles.yAxis}>
          <Text style={styles.axisText}>{maxVal}</Text>
          <Text style={styles.axisText}>{Math.round(maxVal / 2)}</Text>
          <Text style={styles.axisText}>0</Text>
        </View>

        {/* Plot Area */}
        <View style={styles.plotArea} onLayout={onPlotLayout}>
          <View style={[styles.gridLine, { top: 16 }]} />
          <View style={[styles.gridLine, { top: 16 + (plotHeight - 20) / 2 }]} />
          <View style={[styles.gridLine, { top: plotHeight }]} />

          {/* SVG Smooth Curve and Area Gradient Fill */}
          <Svg width={plotWidth} height={plotHeight + 5} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Defs>
              <LinearGradient id="burgundyTrendGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={burgundy} stopOpacity={0.24} />
                <Stop offset="0.65" stopColor={burgundy} stopOpacity={0.06} />
                <Stop offset="1" stopColor={burgundy} stopOpacity={0.0} />
              </LinearGradient>
            </Defs>
            {areaPath ? <Path d={areaPath} fill="url(#burgundyTrendGrad)" /> : null}
            {curvePath ? (
              <Path
                d={curvePath}
                stroke={burgundy}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {coords.map((c, i) => (
              <Circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={c.isPeak ? 5.5 : 4}
                fill={burgundy}
                stroke="#FFFFFF"
                strokeWidth={c.isPeak ? 2.5 : 2}
              />
            ))}
          </Svg>

          {/* Peak Tooltip Callout */}
          {peakCoord && (
            <View
              style={[
                styles.peakBadge,
                {
                  left: Math.max(0, peakCoord.x - 22),
                  top: Math.max(0, peakCoord.y - 30),
                },
              ]}
            >
              <Text style={styles.peakBadgeText}>{peakLabel}</Text>
              <View style={styles.badgeCaret} />
            </View>
          )}
        </View>
      </View>

      {/* X Axis */}
      <View style={styles.xAxis}>
        {points.map((pt, i) => (
          <Text key={pt.hour + i} style={styles.axisText}>
            {pt.hour}
          </Text>
        ))}
      </View>
    </View>
  );
}

// 2. Occupancy by Hour / Day Bar Chart (Fixed Headroom & Overlap)
export function OccupancyByDayChart({
  data,
}: {
  data?: { day: string; value: number; label: string; isPeak?: boolean; peakValue?: string }[];
}) {
  const bars = data && data.length > 0 ? data : [
    { day: 'Mon', value: 35, label: 'Mon' },
    { day: 'Tue', value: 45, label: 'Tue' },
    { day: 'Wed', value: 55, label: 'Wed' },
    { day: 'Thu', value: 65, label: 'Thu' },
    { day: 'Fri', value: 80, label: 'Fri' },
    { day: 'Sat', value: 92, label: 'Sat', isPeak: true, peakValue: '92%' },
    { day: 'Sun', value: 70, label: 'Sun' },
  ];

  const maxBarValue = 100;
  const maxBarPx = 80;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartCardTitle}>Occupancy by Hour</Text>

      {/* Chart container with safe headroom for peak badge */}
      <View style={{ height: 150, marginTop: 12, flexDirection: 'row' }}>
        <View style={styles.plotArea}>
          {/* Dashed Gridlines */}
          <View style={[styles.gridLine, { top: 40 }]} />
          <View style={[styles.gridLine, { top: 75 }]} />
          <View style={[styles.gridLine, { top: 110 }]} />
          <View style={[styles.gridLine, { bottom: 0 }]} />

          {/* Bars */}
          <View style={styles.barsContainer}>
            {bars.map((b) => {
              const barHeight = Math.max(12, Math.round((b.value / maxBarValue) * maxBarPx));
              return (
                <View key={b.day} style={styles.barCol}>
                  {b.isPeak && (
                    <View style={styles.peakCallout}>
                      <Text style={styles.peakCalloutSub}>Peak</Text>
                      <Text style={styles.peakCalloutVal}>{b.peakValue || `${b.value}%`}</Text>
                      <View style={styles.badgeCaret} />
                    </View>
                  )}
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: b.isPeak ? burgundy : gold,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* Y Axis on Right */}
        <View style={[styles.yAxis, { alignItems: 'flex-start', paddingLeft: 8, height: 115, marginTop: 35 }]}>
          <Text style={styles.axisText}>20</Text>
          <Text style={styles.axisText}>15</Text>
          <Text style={styles.axisText}>10</Text>
          <Text style={styles.axisText}>0</Text>
        </View>
      </View>

      {/* X Axis Labels */}
      <View style={[styles.xAxis, { paddingRight: 24, paddingLeft: 4 }]}>
        {bars.map((b) => (
          <Text key={b.day} style={[styles.axisText, b.isPeak && { fontWeight: '700', color: '#151D2E' }]}>
            {b.day}
          </Text>
        ))}
      </View>
    </View>
  );
}

// 3. Table Utilization Multi-Segment SVG Donut Chart
export function TableUtilizationDonut({
  occupied = 78,
  available = 15,
  reserved = 5,
  cleaning = 2,
}: {
  occupied?: number;
  available?: number;
  reserved?: number;
  cleaning?: number;
}) {
  const size = 110;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = (occupied + available + reserved + cleaning) || 100;
  const segments = [
    { label: 'Occupied', percent: occupied, color: burgundy },
    { label: 'Available', percent: available, color: green },
    { label: 'Reserved', percent: reserved, color: orange },
    { label: 'Cleaning', percent: cleaning, color: blue },
  ];

  let cumulativeOffset = 0;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartCardTitle}>Table Utilization</Text>
      <View style={styles.donutRow}>
        {/* Genuine multi-segment SVG Donut matching Figma */}
        <View style={{ width: size, height: size, position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
          <Svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ transform: [{ rotate: '-90deg' }] }}
          >
            <G>
              {/* Background circle track */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#F2F4F7"
                strokeWidth={strokeWidth}
                fill="none"
              />
              {segments.map((seg, idx) => {
                const strokeLength = (seg.percent / total) * circumference;
                const offset = cumulativeOffset;
                cumulativeOffset += strokeLength;
                if (seg.percent <= 0) return null;
                return (
                  <Circle
                    key={idx}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${strokeLength} ${circumference}`}
                    strokeDashoffset={-offset}
                    fill="none"
                  />
                );
              })}
            </G>
          </Svg>

          {/* Centered percentage */}
          <View style={{ position: 'absolute', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={styles.donutCenterText}>{occupied}%</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.donutLegend}>
          {segments.map((seg) => (
            <View key={seg.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <Text style={styles.legendLabel}>{seg.label}</Text>
              <Text style={styles.legendVal}>{seg.percent}%</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// 4. Queue Volume by Hour Bar Chart
export function QueueVolumeChart({
  data,
}: {
  data?: { hour: string; value: number; isPeak?: boolean; tooltip?: string }[];
}) {
  const bars = data && data.length > 0 ? data : [
    { hour: '12 PM', value: 2 },
    { hour: '2 PM', value: 4 },
    { hour: '4 PM', value: 8 },
    { hour: '6 PM', value: 6 },
    { hour: '8 PM', value: 26, isPeak: true, tooltip: '32 parties' },
    { hour: '10 PM', value: 2 },
  ];
  const maxVal = Math.max(30, ...bars.map((b) => b.value));
  const maxBarPx = 75;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartCardTitle}>Queue Volume by Hour</Text>
      <View style={{ height: 140, marginTop: 14, flexDirection: 'row' }}>
        <View style={[styles.yAxis, { height: 100, marginTop: 35 }]}>
          <Text style={styles.axisText}>30</Text>
          <Text style={styles.axisText}>20</Text>
          <Text style={styles.axisText}>10</Text>
          <Text style={styles.axisText}>0</Text>
        </View>
        <View style={styles.plotArea}>
          <View style={[styles.gridLine, { top: 40 }]} />
          <View style={[styles.gridLine, { top: 70 }]} />
          <View style={[styles.gridLine, { top: 100 }]} />
          <View style={[styles.gridLine, { bottom: 0 }]} />

          <View style={[styles.barsContainer, { gap: 8 }]}>
            {bars.map((b, i) => {
              const h = Math.max(8, Math.round((b.value / maxVal) * maxBarPx));
              return (
                <View key={i} style={styles.barCol}>
                  {b.isPeak && (
                    <View style={styles.bubbleTooltip}>
                      <Text style={styles.bubbleTooltipText}>{b.value}</Text>
                      <Text style={styles.bubbleTooltipSub}>parties</Text>
                      <View style={styles.whiteBadgeCaret} />
                    </View>
                  )}
                  <View style={[styles.bar, { height: h, backgroundColor: blue, width: 12, borderRadius: 3 }]} />
                </View>
              );
            })}
          </View>
        </View>
      </View>
      <View style={[styles.xAxis, { paddingLeft: 24 }]}>
        {bars.map((b, i) => (
          <Text key={i} style={styles.axisText}>{b.hour}</Text>
        ))}
      </View>
    </View>
  );
}

// 5. Wait Time Distribution Progress Bars
export function WaitTimeDistributionList({
  data,
}: {
  data?: { label: string; percent: number }[];
}) {
  const items = data && data.length > 0 ? data : [
    { label: '< 10 min', percent: 28 },
    { label: '10 - 20 min', percent: 45 },
    { label: '20 - 30 min', percent: 20 },
    { label: '> 30 min', percent: 7 },
  ];
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartCardTitle}>Wait Time Distribution</Text>
      <View style={{ gap: 14, marginTop: 14 }}>
        {items.map((it) => (
          <View key={it.label} style={styles.distRow}>
            <Text style={styles.distLabel}>{it.label}</Text>
            <View style={styles.distTrack}>
              <View style={[styles.distFill, { width: `${Math.min(100, Math.max(2, it.percent))}%` }]} />
            </View>
            <Text style={styles.distPercent}>{it.percent}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// 6. Walkaways by Hour Chart (Smooth SVG Bezier Curve)
export function WalkawaysChart({
  data,
}: {
  data?: { hour: string; value: number; isPeak?: boolean; tooltip?: string }[];
}) {
  const [plotWidth, setPlotWidth] = useState(260);

  const points = data && data.length > 0 ? data : [
    { hour: '12 PM', value: 0 },
    { hour: '2 PM', value: 1 },
    { hour: '4 PM', value: 1 },
    { hour: '6 PM', value: 2 },
    { hour: '8 PM', value: 7, isPeak: true },
    { hour: '10 PM', value: 4 },
  ];
  const maxVal = Math.max(10, ...points.map((p) => p.value));
  const plotHeight = 110;
  const paddingHoriz = 12;

  const onPlotLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 50 && Math.abs(w - plotWidth) > 2) {
      setPlotWidth(w);
    }
  };

  const coords = points.map((p, i) => {
    const x =
      paddingHoriz +
      (i / Math.max(1, points.length - 1)) * (plotWidth - paddingHoriz * 2);
    const y = Math.max(
      16,
      plotHeight - 8 - (p.value / maxVal) * (plotHeight - 28)
    );
    return { ...p, x, y };
  });

  const { curvePath, areaPath } = getSmoothCurveAndArea(coords, plotHeight);
  const peakCoord = coords.find((c) => c.isPeak) || coords[coords.length - 2];

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartCardTitle}>Walkaways by Hour</Text>
      <View style={{ height: plotHeight + 35, marginTop: 14, flexDirection: 'row' }}>
        <View style={[styles.yAxis, { height: plotHeight, marginTop: 24 }]}>
          <Text style={styles.axisText}>{maxVal}</Text>
          <Text style={styles.axisText}>{Math.round(maxVal / 2)}</Text>
          <Text style={styles.axisText}>0</Text>
        </View>

        <View style={styles.plotArea} onLayout={onPlotLayout}>
          <View style={[styles.gridLine, { top: 16 }]} />
          <View style={[styles.gridLine, { top: 16 + (plotHeight - 20) / 2 }]} />
          <View style={[styles.gridLine, { top: plotHeight }]} />

          {/* SVG Smooth Curve and Area Gradient Fill */}
          <Svg width={plotWidth} height={plotHeight + 5} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Defs>
              <LinearGradient id="walkawaysGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={burgundy} stopOpacity={0.24} />
                <Stop offset="0.65" stopColor={burgundy} stopOpacity={0.06} />
                <Stop offset="1" stopColor={burgundy} stopOpacity={0.0} />
              </LinearGradient>
            </Defs>
            {areaPath ? <Path d={areaPath} fill="url(#walkawaysGrad)" /> : null}
            {curvePath ? (
              <Path
                d={curvePath}
                stroke={burgundy}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {coords.map((c, i) => (
              <Circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={c.isPeak ? 5.5 : 4}
                fill={burgundy}
                stroke="#FFFFFF"
                strokeWidth={c.isPeak ? 2.5 : 2}
              />
            ))}
          </Svg>

          {/* Tooltip callout badge matching Figma */}
          {peakCoord && (
            <View
              style={[
                styles.darkTooltip,
                {
                  left: Math.max(0, peakCoord.x - 28),
                  top: Math.max(0, peakCoord.y - 36),
                },
              ]}
            >
              <Text style={styles.darkTooltipText}>{peakCoord.value}</Text>
              <Text style={styles.darkTooltipSub}>walkaways</Text>
              <View style={styles.badgeCaret} />
            </View>
          )}
        </View>
      </View>
      <View style={[styles.xAxis, { paddingLeft: 24 }]}>
        {points.map((pt, i) => (
          <Text key={i} style={styles.axisText}>{pt.hour}</Text>
        ))}
      </View>
    </View>
  );
}

// 7. No-shows by Reservation Time Chart
export function NoShowsBarChart({
  data,
}: {
  data?: { hour: string; value: number }[];
}) {
  const bars = data && data.length > 0 ? data : [
    { hour: '12 PM', value: 4 },
    { hour: '2 PM', value: 2 },
    { hour: '4 PM', value: 2 },
    { hour: '6 PM', value: 6 },
    { hour: '8 PM', value: 4 },
    { hour: '10 PM', value: 1 },
  ];
  const maxVal = Math.max(10, ...bars.map((b) => b.value));
  const height = 90;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartCardHeaderRow}>
        <Text style={styles.chartCardTitle}>No-shows by Reservation Time</Text>
        <View style={styles.inlineLegend}>
          <View style={[styles.legendSquare, { backgroundColor: blue }]} />
          <Text style={styles.legendSquareText}>No-shows</Text>
        </View>
      </View>
      <View style={{ height: height + 20, marginTop: 14, flexDirection: 'row' }}>
        <View style={[styles.yAxis, { height, marginTop: 15 }]}>
          <Text style={styles.axisText}>{maxVal}</Text>
          <Text style={styles.axisText}>{Math.round(maxVal / 2)}</Text>
          <Text style={styles.axisText}>0</Text>
        </View>
        <View style={styles.plotArea}>
          <View style={[styles.gridLine, { top: 15 }]} />
          <View style={[styles.gridLine, { top: 15 + height / 2 }]} />
          <View style={[styles.gridLine, { top: 15 + height }]} />

          <View style={[styles.barsContainer, { gap: 10 }]}>
            {bars.map((b, i) => {
              const h = Math.max(4, Math.round((b.value / maxVal) * (height - 10)));
              return (
                <View key={i} style={styles.barCol}>
                  <View style={[styles.bar, { height: h, backgroundColor: blue, width: 10, borderRadius: 2 }]} />
                </View>
              );
            })}
          </View>
        </View>
      </View>
      <View style={[styles.xAxis, { paddingLeft: 20 }]}>
        {bars.map((b, i) => (
          <Text key={i} style={styles.axisText}>{b.hour}</Text>
        ))}
      </View>
    </View>
  );
}

// 8. Customer Flow Chart for Daily Report
export function CustomerFlowChart({
  data,
}: {
  data?: { hour: string; reservations: number; walkIns: number; seated: number }[];
}) {
  const points = data && data.length > 0 ? data : [
    { hour: '12 PM', reservations: 12, walkIns: 18, seated: 8 },
    { hour: '2 PM', reservations: 22, walkIns: 17, seated: 20 },
    { hour: '4 PM', reservations: 42, walkIns: 32, seated: 15 },
    { hour: '6 PM', reservations: 38, walkIns: 27, seated: 24 },
    { hour: '8 PM', reservations: 48, walkIns: 41, seated: 35 },
    { hour: '10 PM', reservations: 41, walkIns: 28, seated: 36 },
  ];
  const maxVal = Math.max(30, ...points.map((p) => Math.max(p.reservations, p.walkIns, p.seated)));
  const maxBarPx = 68;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartCardTitle}>Customer Flow</Text>
      <View style={styles.flowLegendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: blue }]} />
          <Text style={styles.legendText}>Reservations</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: orange }]} />
          <Text style={styles.legendText}>Walk-ins</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: green }]} />
          <Text style={styles.legendText}>Seated</Text>
        </View>
      </View>

      <View style={{ height: 110, marginTop: 14, flexDirection: 'row' }}>
        <View style={[styles.yAxis, { height: 80, marginTop: 15 }]}>
          <Text style={styles.axisText}>{maxVal}</Text>
          <Text style={styles.axisText}>{Math.round(maxVal / 2)}</Text>
          <Text style={styles.axisText}>0</Text>
        </View>
        <View style={styles.plotArea}>
          <View style={[styles.gridLine, { top: 15 }]} />
          <View style={[styles.gridLine, { top: 55 }]} />
          <View style={[styles.gridLine, { bottom: 0 }]} />

          <View style={[styles.barsContainer, { gap: 8, paddingBottom: 2 }]}>
            {points.map((p, i) => {
              const resH = Math.max(3, Math.round((p.reservations / maxVal) * maxBarPx));
              const walkH = Math.max(3, Math.round((p.walkIns / maxVal) * maxBarPx));
              const seatH = Math.max(3, Math.round((p.seated / maxVal) * maxBarPx));
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                  <View style={[styles.bar, { height: resH, backgroundColor: blue, width: 6, borderRadius: 2 }]} />
                  <View style={[styles.bar, { height: walkH, backgroundColor: orange, width: 6, borderRadius: 2 }]} />
                  <View style={[styles.bar, { height: seatH, backgroundColor: green, width: 6, borderRadius: 2 }]} />
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={[styles.xAxis, { paddingLeft: 24 }]}>
        {points.map((p, i) => (
          <Text key={i} style={styles.axisText}>{p.hour}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0F1F3',
    boxShadow: '0 1px 3px rgba(16,24,40,0.04)',
    marginVertical: 6,
  },
  chartCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#151D2E',
  },
  chartCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inlineLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendSquareText: {
    fontSize: 11,
    color: '#697386',
  },
  chartContainer: {
    flexDirection: 'row',
  },
  yAxis: {
    width: 28,
    justifyContent: 'space-between',
    paddingVertical: 2,
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  axisText: {
    fontSize: 10,
    color: '#98A2B3',
  },
  plotArea: {
    flex: 1,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
    borderStyle: 'dashed',
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 28,
    paddingRight: 8,
    marginTop: 8,
  },
  peakBadge: {
    position: 'absolute',
    backgroundColor: burgundy,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    zIndex: 10,
  },
  peakBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeCaret: {
    position: 'absolute',
    bottom: -4,
    width: 6,
    height: 6,
    backgroundColor: burgundy,
    transform: [{ rotate: '45deg' }],
  },
  barsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingBottom: 2,
  },
  barCol: {
    alignItems: 'center',
    position: 'relative',
  },
  bar: {
    width: 16,
    borderRadius: 4,
  },
  peakCallout: {
    position: 'absolute',
    top: -34,
    backgroundColor: burgundy,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    zIndex: 10,
  },
  peakCalloutSub: {
    color: '#FFA3AF',
    fontSize: 8,
    fontWeight: '600',
  },
  peakCalloutVal: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  bubbleTooltip: {
    position: 'absolute',
    top: -32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
    zIndex: 10,
  },
  bubbleTooltipText: {
    color: '#151D2E',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  bubbleTooltipSub: {
    color: '#697386',
    fontSize: 8,
    lineHeight: 10,
  },
  whiteBadgeCaret: {
    position: 'absolute',
    bottom: -4,
    width: 6,
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E4E7EC',
    transform: [{ rotate: '45deg' }],
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 16,
  },
  donutCenterText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#151D2E',
  },
  donutLegend: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    color: '#475467',
  },
  legendVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#151D2E',
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distLabel: {
    width: 72,
    fontSize: 12,
    color: '#475467',
  },
  distTrack: {
    flex: 1,
    height: 12,
    backgroundColor: '#F2F4F7',
    borderRadius: 6,
    overflow: 'hidden',
  },
  distFill: {
    height: '100%',
    backgroundColor: blue,
    borderRadius: 6,
  },
  distPercent: {
    width: 34,
    fontSize: 12,
    fontWeight: '600',
    color: '#151D2E',
    textAlign: 'right',
  },
  darkTooltip: {
    position: 'absolute',
    backgroundColor: '#7A1828',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    zIndex: 10,
  },
  darkTooltipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  darkTooltipSub: {
    color: '#FFB8C1',
    fontSize: 8,
    lineHeight: 10,
  },
  flowLegendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#475467',
  },
});
