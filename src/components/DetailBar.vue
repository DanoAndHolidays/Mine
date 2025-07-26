<script setup>
import { onMounted, ref } from 'vue';
import * as echarts from "echarts";

const props = defineProps({
    nameData: {
        type: Object,
        required: true,
    },
});

const target = ref(null);
const target2 = ref(null);
const target3 = ref(null);
const target4 = ref(null);
const target5 = ref(null);
let myChart = null;
let myChart2 = null;
let myChart3 = null;
let myChart4 = null;
let myChart5 = null;
const options = {
    tooltip: {
        trigger: 'item'
    },
    legend: {
        top: '5%',
        left: 'center'
    },
    series: [
        {
            name: 'Access From',
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 10,
                borderColor: '#fff',
                borderWidth: 2
            },
            label: {
                show: false,
                position: 'center'
            },
            emphasis: {
                label: {
                    show: true,
                    fontSize: 40,
                    fontWeight: 'bold'
                }
            },
            labelLine: {
                show: false
            },
            data: [
                { value: 1048, name: 'Search Engine' },
                { value: 735, name: 'Direct' },
                { value: 580, name: 'Email' },
                { value: 484, name: 'Union Ads' },
                { value: 300, name: 'Video Ads' }
            ]
        }
    ]
};

// prettier-ignore
const hours = [
    '12a', '1a', '2a', '3a', '4a', '5a', '6a',
    '7a', '8a', '9a', '10a', '11a',
    '12p', '1p', '2p', '3p', '4p', '5p',
    '6p', '7p', '8p', '9p', '10p', '11p'
];
// prettier-ignore
const days = [
    'Saturday', 'Friday', 'Thursday',
    'Wednesday', 'Tuesday', 'Monday', 'Sunday'
];
// prettier-ignore
const data = [[0, 0, 5], [0, 1, 1], [0, 2, 0], [0, 3, 0], [0, 4, 0], [0, 5, 0], [0, 6, 0], [0, 7, 0], [0, 8, 0], [0, 9, 0], [0, 10, 0], [0, 11, 2], [0, 12, 4], [0, 13, 1], [0, 14, 1], [0, 15, 3], [0, 16, 4], [0, 17, 6], [0, 18, 4], [0, 19, 4], [0, 20, 3], [0, 21, 3], [0, 22, 2], [0, 23, 5], [1, 0, 7], [1, 1, 0], [1, 2, 0], [1, 3, 0], [1, 4, 0], [1, 5, 0], [1, 6, 0], [1, 7, 0], [1, 8, 0], [1, 9, 0], [1, 10, 5], [1, 11, 2], [1, 12, 2], [1, 13, 6], [1, 14, 9], [1, 15, 11], [1, 16, 6], [1, 17, 7], [1, 18, 8], [1, 19, 12], [1, 20, 5], [1, 21, 5], [1, 22, 7], [1, 23, 2], [2, 0, 1], [2, 1, 1], [2, 2, 0], [2, 3, 0], [2, 4, 0], [2, 5, 0], [2, 6, 0], [2, 7, 0], [2, 8, 0], [2, 9, 0], [2, 10, 3], [2, 11, 2], [2, 12, 1], [2, 13, 9], [2, 14, 8], [2, 15, 10], [2, 16, 6], [2, 17, 5], [2, 18, 5], [2, 19, 5], [2, 20, 7], [2, 21, 4], [2, 22, 2], [2, 23, 4], [3, 0, 7], [3, 1, 3], [3, 2, 0], [3, 3, 0], [3, 4, 0], [3, 5, 0], [3, 6, 0], [3, 7, 0], [3, 8, 1], [3, 9, 0], [3, 10, 5], [3, 11, 4], [3, 12, 7], [3, 13, 14], [3, 14, 13], [3, 15, 12], [3, 16, 9], [3, 17, 5], [3, 18, 5], [3, 19, 10], [3, 20, 6], [3, 21, 4], [3, 22, 4], [3, 23, 1], [4, 0, 1], [4, 1, 3], [4, 2, 0], [4, 3, 0], [4, 4, 0], [4, 5, 1], [4, 6, 0], [4, 7, 0], [4, 8, 0], [4, 9, 2], [4, 10, 4], [4, 11, 4], [4, 12, 2], [4, 13, 4], [4, 14, 4], [4, 15, 14], [4, 16, 12], [4, 17, 1], [4, 18, 8], [4, 19, 5], [4, 20, 3], [4, 21, 7], [4, 22, 3], [4, 23, 0], [5, 0, 2], [5, 1, 1], [5, 2, 0], [5, 3, 3], [5, 4, 0], [5, 5, 0], [5, 6, 0], [5, 7, 0], [5, 8, 2], [5, 9, 0], [5, 10, 4], [5, 11, 1], [5, 12, 5], [5, 13, 10], [5, 14, 5], [5, 15, 7], [5, 16, 11], [5, 17, 6], [5, 18, 0], [5, 19, 5], [5, 20, 3], [5, 21, 4], [5, 22, 2], [5, 23, 0], [6, 0, 1], [6, 1, 0], [6, 2, 0], [6, 3, 0], [6, 4, 0], [6, 5, 0], [6, 6, 0], [6, 7, 0], [6, 8, 0], [6, 9, 0], [6, 10, 1], [6, 11, 0], [6, 12, 2], [6, 13, 1], [6, 14, 3], [6, 15, 4], [6, 16, 0], [6, 17, 0], [6, 18, 0], [6, 19, 0], [6, 20, 1], [6, 21, 2], [6, 22, 2], [6, 23, 6]]
    .map(function (item) {
        return [item[1], item[0], item[2] || '-'];
    });
const options2 = {
    tooltip: {
        position: 'top'
    },
    grid: {
        height: '50%',
        top: '10%'
    },
    xAxis: {
        type: 'category',
        data: hours,
        splitArea: {
            show: true
        }
    },
    yAxis: {
        type: 'category',
        data: days,
        splitArea: {
            show: true
        }
    },
    visualMap: {
        min: 0,
        max: 10,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '15%'
    },
    series: [
        {
            name: 'Punch Card',
            type: 'heatmap',
            data: data,
            label: {
                show: true
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }
    ]
};
const options3 = {
    xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },
    yAxis: {
        type: 'value'
    },
    series: [
        {
            data: [150, 230, 224, 218, 135, 147, 260],
            type: 'line'
        }
    ]
};

const options4 = {
    grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
    },
    xAxis: {
        type: 'category',
        boundaryGap: false,
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },
    yAxis: {
        type: 'value'
    },
    series: [
        {
            name: 'Email',
            type: 'line',
            stack: 'Total',
            data: [120, 132, 101, 134, 90, 230, 210]
        },
        {
            name: 'Union Ads',
            type: 'line',
            stack: 'Total',
            data: [220, 182, 191, 234, 290, 330, 310]
        },
        {
            name: 'Video Ads',
            type: 'line',
            stack: 'Total',
            data: [150, 232, 201, 154, 190, 330, 410]
        },
        {
            name: 'Direct',
            type: 'line',
            stack: 'Total',
            data: [320, 332, 301, 334, 390, 330, 320]
        },
        {
            name: 'Search Engine',
            type: 'line',
            stack: 'Total',
            data: [820, 932, 901, 934, 1290, 1330, 1320]
        }
    ]
};

const options5 = {
    legend: {
        data: ['Allocated Budget', 'Actual Spending']
    },
    radar: {
        // shape: 'circle',
        indicator: [
            { name: 'Sales', max: 6500 },
            { name: 'Administration', max: 16000 },
            { name: 'Information Technology', max: 30000 },
            { name: 'Customer Support', max: 38000 },
            { name: 'Development', max: 52000 },
            { name: 'Marketing', max: 25000 }
        ]
    },
    series: [
        {
            name: 'Budget vs spending',
            type: 'radar',
            data: [
                {
                    value: [4200, 3000, 20000, 35000, 50000, 18000],
                    name: 'Allocated Budget'
                },
                {
                    value: [5000, 14000, 28000, 26000, 42000, 21000],
                    name: 'Actual Spending'
                }
            ]
        }
    ]
};

onMounted(() => {
    myChart = echarts.init(target.value);
    myChart.setOption(options);

    myChart2 = echarts.init(target2.value);
    myChart2.setOption(options2);

    // myChart3 = echarts.init(target3.value);
    // myChart3.setOption(options3);

    myChart4 = echarts.init(target4.value);
    myChart4.setOption(options4);

    myChart5 = echarts.init(target5.value);
    myChart5.setOption(options5);
})
</script>

<template>

    <div class="relative w-full h-full">
        <div class="right-bar w-[400px] absolute top-[-30px] left-[-10px]">
            <p class="text-gradient btn-hover ">{{ nameData.name + "-" + nameData.age }}</p>
        </div>
        <div class="flex h-full w-full">
            <div ref="target4" class="h-full flex-1"></div>
            <div ref="target2" class="h-full flex-1"></div>
            <div ref="target5" class="h-full  flex-1"></div>
            <div ref="target" class="h-full flex-1"></div>
            <div ref="target3" class="h-full flex-1">
                <div class="flex">
                    <div class="w-1/2 mr-3">
                        <div>
                            <label for="index-select" class="block text-sm font-medium text-gradient my-1">实验数据</label>
                            <select id="index-select" class="px-3 blue-border focus:outline-none">
                                <option value="">请选择...</option>
                                <optgroup label="KuZ23">
                                    <option value="1">KuZ23-80</option>
                                    <option value="2">KuZ23-82</option>
                                    <option value="3">KuZ23-85</option>
                                </optgroup>
                                <optgroup label="Zar78">
                                    <option value="4">Zar78-90</option>
                                    <option value="5">Zar78-92</option>
                                    <option value="6">Zar78-95</option>
                                </optgroup>
                            </select>
                            <button id="index-bt" class="btn blue-border px-3 mt-3">加载数据</button>
                        </div>
                        <div>
                            <label for="index-pro" class="block text-sm font-medium text-gradient my-1">加载进度 {{
                                }}%</label>
                            <div class="blue-border px-3 mr-3">进度条</div>
                        </div>
                        <div>
                            <label for="index-pro" class="block text-sm font-medium text-gradient my-1">操作区 {{
                                }}</label>
                            <button class="btn blue-border px-3 mr-3 mb-3">开始</button>
                            <button class="btn blue-border px-3 mr-3">暂停</button>
                            <button class="btn blue-border px-3 mr-3">继续</button>
                            <button class="btn blue-border px-3">结束</button>
                        </div>
                    </div>
                    <div class="w-1/2">
                        <div>
                            <label for="index-pro" class="block text-sm font-medium text-gradient my-1">实验预警 {{
                                }}</label>
                            <div class="blue-border px-3 mr-3">预警信息</div>
                        </div>
                        <div>
                            <label for="index-pro" class="block text-sm font-medium text-gradient my-1">实验进度 {{
                                }}%</label>
                            <div class="blue-border px-3 mr-3">进度条</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped></style>