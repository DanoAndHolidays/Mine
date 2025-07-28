<template>
  <div>
    <div ref="target" class="w-full h-full"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import * as echarts from "echarts";
import { useCsvStore } from "../stores/csv";
import { usePreStore } from "../stores/pre";
const csvStore = useCsvStore();
const preStore = usePreStore();


const target = ref(null);
let myChart = null;

onMounted(() => {
  myChart = echarts.init(target.value);
  renderChart();
});

// 用于存储累积结果的全局数组
let simCsv = [];
let preCsv = [];
let timCsv = [];
let damCsv = [];
let rangesData = [];

let ranges = getValueRanges(damCsv);
function reSetArray() {
  simCsv = [];
  preCsv = [];
  timCsv = [];
  damCsv = [];
  rangesData = [];
}

function setChartRanges() {
  rangesData = [
    {
      data: [{
        name: `${ranges.length >= 1 ? '模型加载' : ''}`,
        xAxis: `${ranges.length >= 1 ? ranges[0][1] : '0'}`,
      },
      {
        xAxis: `${ranges.length >= 1 ? ranges[0][2] : '0'}`,
      }],
    },
    {
      data: [{
        name: `${ranges.length >= 2 ? '弹性加载' : ''}`,
        xAxis: `${ranges.length >= 2 ? ranges[1][1] : '0'}`,
      },
      {
        xAxis: `${ranges.length >= 2 ? ranges[1][2] : '0'}`,
      }],

    },
    {
      data: [{
        name: `${ranges.length >= 3 ? '裂隙演化' : ''}`,
        xAxis: `${ranges.length >= 3 ? ranges[2][1] : '0'}`,
      },
      {
        xAxis: `${ranges.length >= 3 ? ranges[2][2] : '0'}`,
      }],
    },
    {
      data: [{
        name: `${ranges.length >= 4 ? '急剧破坏' : ''}`,
        xAxis: `${ranges.length >= 4 ? ranges[3][1] : '0'}`,
      },
      {
        xAxis: `${ranges.length >= 4 ? ranges[3][2] : '0'}`,
      }],
    }
  ];
}

function getValueRanges(arr) {
  const result = [];
  let currentValue = null;
  let startIndex = null;

  for (let index = 0; index < arr.length; index++) {
    const value = arr[index];
    if (currentValue === null) {
      currentValue = value;
      startIndex = index;
    } else if (value !== currentValue) {
      result.push([currentValue, startIndex, index - 1]);
      currentValue = value;
      startIndex = index;
    }
  }

  if (currentValue !== null) {
    result.push([currentValue, startIndex, arr.length - 1]);
  }

  return result;
}
function accumulateTimArray(newArray) {
  if (!csvStore.data.map(item => item.time_index)) {
    return;
  }
  // 验证输入是否为数组
  if (!Array.isArray(newArray)) {
    console.error('传入的不是数组，无法累积');
    return timCsv;
  }
  // 将新数组元素添加到累积数组中
  timCsv = [...timCsv, ...newArray];
  // 返回更新后的累积数组
  return timCsv;
}

function accumulateSimArray(newArray) {
  if (!csvStore.data.map(item => item.time_index)) {
    return;
  }
  // 验证输入是否为数组
  if (!Array.isArray(newArray)) {
    console.error('传入的不是数组，无法累积');
    return simCsv;
  }
  // 将新数组元素添加到累积数组中
  simCsv = [...simCsv, ...newArray];
  // 返回更新后的累积数组
  return simCsv;
}

function accumulatePreArray(newArray) {
  if (!csvStore.data.map(item => item.time_index)) {
    return;
  }
  // 验证输入是否为数组
  if (!Array.isArray(newArray)) {
    console.error('传入的不是数组，无法累积');
    return preCsv;
  }
  // 将新数组元素添加到累积数组中
  preCsv = [...preCsv, ...newArray];
  // 返回更新后的累积数组
  return preCsv;
}

function accumulateDamArray(newArray) {
  if (!csvStore.data.map(item => item.time_index)) {
    return;
  }
  // 验证输入是否为数组
  if (!Array.isArray(newArray)) {
    console.error('传入的不是数组，无法累积');
    return damCsv;
  }
  // 将新数组元素添加到累积数组中
  damCsv = [...damCsv, ...newArray];
  // 返回更新后的累积数组
  return damCsv;
}


const renderChart = () => {
  addArray();
  ranges = getValueRanges(damCsv);
  setChartRanges();
  const options = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: 'white',
          color: '#505050',
        },
      }
    },
    textStyle: {
      color: '#ffffff',
    },
    toolbox: {
      show: true,
      iconStyle: {
        borderColor: 'white',
      },
      feature: {
        saveAsImage: {
        },
      }
    },
    grid: {
      left: '0%',
      right: '0%',
      bottom: '0%',
      top: '20%',
      containLabel: true,
    },
    title: {
      text: '应力趋势预测',
      textStyle: {    // 文字大小
        fontFamily: 'Arial', // 字体
        color: '#ffffff',       // 文字颜色
        fontWeight: '100',  // 字重（normal/bold/bolder/lighter/100-900）
        fontStyle: 'normals'  // 字体风格（normal/italic/oblique）
      },
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['原始数据', '预测数据'],
      textStyle: {
        fontSize: 15,       // 文字大小
        fontFamily: 'Arial', // 字体
        color: '#ffffff',       // 文字颜色
        fontWeight: '100',  // 字重（normal/bold/bolder/lighter/100-900）
      },
    },
    xAxis: {
      type: 'category',
      data: timCsv,
    },
    yAxis: {
      splitLine: {
        show: true,  // 显示网格线
        lineStyle: {
          color: '#a0a0a0',  // 浅灰色网格线
          width: 1,
          type: 'dashed'  // 虚线样式
        }
      },
      type: 'value'
    },
    series: [
      {
        markArea: {
          label:
          {
            color: 'white',
          },
          textStyle: {       // 文字大小
            fontFamily: 'Arial', // 字体
            color: '#ffffff',       // 文字颜色
            fontWeight: '100',  // 字重（normal/bold/bolder/lighter/100-900）
            fontStyle: 'normals'  // 字体风格（normal/italic/oblique）
          },
          silent: true,
          itemStyle: {
            opacity: 0.2,
            color: 'blue',
          },
          data: [
            rangesData[0].data,
          ],
        },
        showSymbol: false,
        name: '原始数据',
        type: 'line', // 修改为 line 表示柱状图
        data: simCsv,
        // 柱子颜色
        itemStyle: {
          color: '#37A2DA'
        },
      },
      {
        markArea: {
          label:
          {
            color: 'white',
          },
          textStyle: {       // 文字大小
            fontFamily: 'Arial', // 字体
            color: '#ffffff',       // 文字颜色
            fontWeight: '100',  // 字重（normal/bold/bolder/lighter/100-900）
            fontStyle: 'normals'  // 字体风格（normal/italic/oblique）
          },
          silent: true,
          itemStyle: {
            opacity: 0.2,
            color: 'yellow',
          },
          data: [
            rangesData[2].data,
          ],
        },
        showSymbol: false,
        name: '原始数据',
        type: 'line', // 修改为 line 表示柱状图
        data: simCsv,
        // 柱子颜色
        itemStyle: {
          color: '#37A2DA'
        },
      },
      {
        markArea: {
          label:
          {
            color: 'white',
          },
          textStyle: {       // 文字大小
            fontFamily: 'Arial', // 字体
            color: '#ffffff',       // 文字颜色
            fontWeight: '100',  // 字重（normal/bold/bolder/lighter/100-900）
            fontStyle: 'normals'  // 字体风格（normal/italic/oblique）
          },
          silent: true,
          itemStyle: {
            opacity: 0.2,
            color: 'red',
          },
          data: [
            rangesData[3].data,
          ],
        },
        showSymbol: false,
        name: '原始数据',
        type: 'line', // 修改为 line 表示柱状图
        data: simCsv,
        // 柱子颜色
        itemStyle: {
          color: '#37A2DA'
        }
      },

      {
        markArea: {

          silent: true,
          itemStyle: {
            opacity: 0.2,
            color: 'green',
          },
          data: [
            rangesData[1].data,
          ],
          label:
          {
            color: 'white',
          }// 第一个 markArea 的字体颜色为红色

        },
        showSymbol: false,
        name: '预测数据',
        type: 'line',
        data: preCsv,
        lineStyle: {
          // 设置为虚线
          type: 'dashed',  // 'dashed' 虚线, 'dotted' 点线
          width: 2,        // 线宽
          color: '#FD666D', // 线颜色
        },
        itemStyle: {
          color: '#FD666D',
        },
      }
    ]
  };
  // 3.通过实例.setOptions(option)
  myChart.setOption(options);

};

function addArray() {
  if (csvStore.data.length != 0 && preStore.data.length != 0) {
    accumulateTimArray(csvStore.data.map(item => item.time_index));
    accumulateSimArray(csvStore.data.map(item => item.stress));
    accumulatePreArray(preStore.data.map(item => item.pre_stress));
    accumulateDamArray(preStore.data.map(item => item.damage_stage));
  } else {
    return;
  }

}

watch(
  () => preStore.data,
  () => {
    renderChart();
  }
);

watch(() => preStore.reset2, () => {
  reSetArray();
  renderChart();
  preStore.reset2 = false;
})
</script>

<style lang="scss" scoped></style>
