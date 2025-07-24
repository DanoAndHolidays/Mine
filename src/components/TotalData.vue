<template>
  <div class="total-data">
    <div class="p-0">
      <!-- 总数据 -->

      <div class="total-text header-gradient">实验控制台</div>
      <!-- <div class=" text-slate-300 text-center">


        数据总量：
        <span ref="totalCountTarget" class="text-gradient font-[Myfont]  text-7xl ml-2 mr-2 font-bold">
          679,473,929
        </span>
        条记录
      </div>

      
      <div class=" mt-3 flex flex-wrap">
        <div class=" w-1/3 text-center text-slate-400 text-sm">
          华北：<span ref="city1" class="font-[Myfont] text-[#5dc5ef] text-3xl">9,778,988</span>
        </div>
        <div class=" w-1/3 text-center text-slate-400 text-sm">
          东北：<span ref="city2" class="font-[Myfont] text-[#5dc5ef] text-3xl">9,778,988</span>
        </div>
        <div class=" w-1/3 text-center text-slate-400 text-sm">
          华东：<span ref="city3" class="font-[Myfont] text-[#5dc5ef] text-3xl">9,778,988</span>
        </div>
        <div class=" w-1/3 text-center text-slate-400 text-sm">
          中南：<span ref="city4" class="font-[Myfont] text-[#5dc5ef] text-3xl">9,778,988</span>
        </div>
        <div class=" w-1/3 text-center text-slate-400 text-sm">
          西南：<span ref="city5" class="font-[Myfont] text-[#5dc5ef] text-3xl">9,778,988</span>
        </div>
        <div class=" w-1/3 text-center text-slate-400 text-sm">
          西北：<span ref="city6" class="font-[Myfont] text-[#5dc5ef] text-3xl">9,778,988</span>
        </div>

      </div> -->
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
            <button id="index-bt" class="btn blue-border px-3 mx-3">加载数据</button>
          </div>
          <div>
            <label for="index-pro" class="block text-sm font-medium text-gradient my-1">加载进度 {{ prog1 }}%</label>
            <div class="blue-border px-3 mr-3">进度条</div>
          </div>
          <div>
            <label for="index-pro" class="block text-sm font-medium text-gradient my-1">操作区 {{ state }}</label>
            <button class="btn blue-border px-3 mr-3">开始</button>
            <button class="btn blue-border px-3 mr-3">暂停</button>
            <button class="btn blue-border px-3 mr-3">继续</button>
            <button class="btn blue-border px-3">结束</button>
          </div>
        </div>
        <div class="w-1/2">
          <div>
            <label for="index-pro" class="block text-sm font-medium text-gradient my-1">实验预警 {{ alert }}</label>
            <div class="blue-border px-3 mr-3">预警信息</div>
          </div>
          <div>
            <label for="index-pro" class="block text-sm font-medium text-gradient my-1">实验进度 {{ prog2 }}%</label>
            <div class="blue-border px-3 mr-3">进度条</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>

let state = '暂停';
let alert = '危险';

let prog1 = 30;
let prog2 = 45;

import { CountUp } from 'countup.js'
import { ref, onMounted } from 'vue'
const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

const totalCountTarget = ref(null)
const city1 = ref(null)
const city2 = ref(null)
const city3 = ref(null)
const city4 = ref(null)
const city5 = ref(null)
const city6 = ref(null)

onMounted(() => {
  new CountUp(totalCountTarget.value, props.data.total).start()
  new CountUp(city1.value, props.data.hb).start()
  new CountUp(city2.value, props.data.db).start()
  new CountUp(city3.value, props.data.hd).start()
  new CountUp(city4.value, props.data.zn).start()
  new CountUp(city5.value, props.data.xn).start()
  new CountUp(city6.value, props.data.xb).start()
})

</script>

<style lang="scss" scoped>
.total-data {
  background-image: url(/src/assets/images/bar1.png);
  background-position: 0px 0px;
  background-size: 100%;
  background-repeat: no-repeat;
  padding-top: 0;
}

.total-text {
  text-align: center;
  font-weight: bold;
  font-size: 30px;
  letter-spacing: 3px;
}
</style>