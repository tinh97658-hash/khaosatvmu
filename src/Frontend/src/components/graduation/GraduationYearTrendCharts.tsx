import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import type { CallbackDataParams, EChartsOption } from 'echarts/types/dist/shared';
import type { GraduationYearOverviewPoint } from '../../types/graduationAnalytics';

echarts.use([
  LineChart,
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  LabelLayout,
  CanvasRenderer,
]);

const outcomeSeries = [
  { key: 'excellentCount', label: 'Xuất sắc', color: '#0788b8', labelPosition: 'top' },
  { key: 'veryGoodCount', label: 'Giỏi', color: '#38a3a5', labelPosition: 'top' },
  { key: 'goodCount', label: 'Khá', color: '#4677f5', labelPosition: 'top' },
  { key: 'averageCount', label: 'Trung bình', color: '#e58b2a', labelPosition: 'bottom' },
  { key: 'workStudyTransferCount', label: 'Chuyển VHVL', color: '#8a5cb8', labelPosition: 'bottom' },
] as const;

const formatNumber = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const formatPercent = (value: number) => `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character] ?? character);

interface GraduationOutcomeTrendChartProps {
  data: GraduationYearOverviewPoint[];
}

export function GraduationOutcomeTrendChart({ data }: GraduationOutcomeTrendChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const option = useMemo<EChartsOption>(() => {
    const maximumRate = Math.max(0, ...data.flatMap((point) => outcomeSeries.map((item) =>
      point.complete && point.totalOutcome > 0 ? point[item.key] / point.totalOutcome * 100 : 0)));
    const axisMaximum = Math.min(100, Math.max(10, Math.ceil(maximumRate * 1.2 / 10) * 10));

    return {
      animationDuration: 350,
      aria: { enabled: true },
      color: outcomeSeries.map((item) => item.color),
      tooltip: {
        trigger: 'item',
        formatter: (rawParams: CallbackDataParams | CallbackDataParams[]) => {
          const params = Array.isArray(rawParams) ? rawParams[0] : rawParams;
          if (!params || typeof params.seriesIndex !== 'number') return '';
          const point = data[params.dataIndex];
          const item = outcomeSeries[params.seriesIndex];
          if (!point || !item) return '';
          const count = point[item.key];
          const rate = point.totalOutcome > 0 ? count / point.totalOutcome * 100 : 0;
          return [
            `<strong>Năm ${escapeHtml(point.reviewYear)}</strong>`,
            `${typeof params.marker === 'string' ? params.marker : ''}${escapeHtml(item.label)}: <strong>${escapeHtml(formatPercent(rate))}</strong>`,
            `Số lượng: ${escapeHtml(formatNumber(count))}/${escapeHtml(formatNumber(point.totalOutcome))} sinh viên`,
          ].join('<br/>');
        },
      },
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'middle',
        itemWidth: 18,
        itemHeight: 3,
        textStyle: { color: '#52606a', fontSize: 11 },
      },
      grid: { top: 28, right: 142, bottom: 48, left: 58 },
      xAxis: {
        type: 'category',
        data: data.map((point) => String(point.reviewYear)),
        name: 'Năm xét',
        nameLocation: 'middle',
        nameGap: 30,
        boundaryGap: false,
        axisTick: { alignWithLabel: true },
        axisLabel: { color: '#59636c', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: axisMaximum,
        interval: axisMaximum <= 20 ? 5 : 10,
        name: 'Cơ cấu (%)',
        nameTextStyle: { color: '#68737d', fontSize: 11 },
        axisLabel: { formatter: (value: number) => `${value}%`, color: '#59636c' },
        splitLine: { lineStyle: { color: '#d9dfe3', type: 'dashed' } },
      },
      series: outcomeSeries.map((item) => ({
        name: item.label,
        type: 'line',
        smooth: 0.35,
        smoothMonotone: 'x',
        symbol: 'circle',
        symbolSize: 7,
        connectNulls: false,
        data: data.map((point) => point.complete && point.totalOutcome > 0
          ? point[item.key] / point.totalOutcome * 100
          : null),
        lineStyle: { width: 2.3, cap: 'round', join: 'round' },
        itemStyle: { color: item.color, borderColor: '#fff', borderWidth: 1.5 },
        label: {
          show: true,
          position: item.labelPosition,
          distance: 7,
          color: item.color,
          fontSize: 10,
          fontWeight: 650,
          formatter: (params: CallbackDataParams) => typeof params.value === 'number'
            ? formatPercent(params.value)
            : '',
        },
        emphasis: { focus: 'series' },
      })),
      media: [{
        query: { maxWidth: 720 },
        option: {
          legend: { orient: 'horizontal', left: 'center', right: 'auto', top: 0 },
          grid: { top: 68, right: 22, bottom: 48, left: 52 },
        },
      }],
    };
  }, [data]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = echarts.init(host, undefined, { renderer: 'canvas' });
    chart.setOption(option, { notMerge: true });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);

  return <div ref={hostRef} className="graduation-year-chart" />;
}
