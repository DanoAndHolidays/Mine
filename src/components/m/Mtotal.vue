<template>
  <div>
    <div class=" p-3">
      <!-- 总数据 -->
      <div class=" text-slate-300 text-center">
        数据总量：
        <span ref="totalCountTarget" class="text-gradient font-[Electronic]  text-4xl ml-2 mr-2 font-bold">
          679,473,929
        </span>
        条记录
      </div>

      <!-- 其他数据 -->
      <div class=" mt-3 flex flex-wrap">
        <div class=" w-1/2 text-center text-slate-400 text-sm">
          数据一：<span ref="city1" class="font-[Electronic] text-[#5dc5ef] text-3xl">9,778,988</span>
        </div>
        <div class=" w-1/2 text-center text-slate-400 text-sm">
          数据二：<span ref="city2" class="font-[Electronic] text-[#5dc5ef] text-3xl">9,778,988</span>
        </div>
        <div class=" w-1/2 text-center text-slate-400 text-sm">
          数据三：<span ref="city3" class="font-[Electronic] text-[#5dc5ef] text-3xl">9,778,988</span>
        </div>
        <div class=" w-1/2 text-center text-slate-400 text-sm">
          数据四：<span ref="city4" class="font-[Electronic] text-[#5dc5ef] text-3xl">9,778,988</span>
        </div>
        <div class=" w-1/2 text-center text-slate-400 text-sm">
          数据五：<span ref="city5" class="font-[Electronic] text-[#5dc5ef] text-3xl">9,778,988</span>
        </div>
        <div class=" w-1/2 text-center text-slate-400 text-sm">
          数据六：<span ref="city6" class="font-[Electronic] text-[#5dc5ef] text-3xl">9,778,988</span>
        </div>

      </div>

    </div>
  </div>
</template>

<script setup>
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

<style lang="scss" scoped></style>