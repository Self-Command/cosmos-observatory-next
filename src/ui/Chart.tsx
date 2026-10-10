import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { HeatmapChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
echarts.use([HeatmapChart,PieChart,GridComponent,TooltipComponent,VisualMapComponent,CanvasRenderer]);
export function Chart({option}:{option:echarts.EChartsCoreOption}){
  const ref=useRef<HTMLDivElement>(null),instance=useRef<echarts.ECharts|undefined>(undefined);
  useEffect(()=>{if(!ref.current)return;const chart=echarts.init(ref.current,undefined,{renderer:'canvas'});instance.current=chart;const observer=new ResizeObserver(()=>chart.resize());observer.observe(ref.current);return()=>{observer.disconnect();chart.dispose();instance.current=undefined;};},[]);
  useEffect(()=>{instance.current?.setOption(option,true);},[option]);
  return <div ref={ref} className="chart" aria-label="依据真实关系和事件绘制的图表"/>;
}
