<script setup>
import DetailBar from '../../components/DetailBar.vue';
import { useRouter } from 'vue-router';
const $router = useRouter();
const toIndex = () => {
    $router.push({ path: "/" })
}

</script>

<template>
    <div class="w-full h-full ">

        <div class="bg-[url('assets/images/bg5.jpeg')] bg-cover bg-center h-screen
     text-white p-10 pt-20 overflow-hidden flex flex-col">
            <div class="header header-gradient"> “深岩智测”——基于多维信息感知与智能分析的深部开采煤岩损伤演化预警平台</div>
            <div class=" routerlink ">
                <button @click="toIndex" class="text-gradient header ">
                    主页
                </button>
            </div>
            <div class="rounded-xl flex-1 border border-dark-100 shadow-md
             bg-dark-200/20 shadow-blue-800/40">
                <DetailBar :data="{ name: 'chart', age: 21 }" />
            </div>
            <div class="rounded-xl flex-1 mt-10 border border-dark-100 shadow-md
             bg-dark-200/20 shadow-blue-800/40">
                <DetailBar :data="{ name: 'demo', age: 22 }" />
            </div>
            <div class="rounded-xl flex-1 mt-10 border border-dark-100 shadow-md
             bg-dark-200/20 shadow-blue-800/40">
                <DetailBar :data="{ name: 'test', age: 23 }" />
            </div>

        </div>



    </div>
</template>

<style lang="scss" scoped>
div {
    box-sizing: border-box;
}
</style>