import { defineStore } from "pinia";
import { ref } from "vue";

export const usePreStore = defineStore('pre', () => {
    const reset = ref(false);

    const data = ref([1, 1, 1, 1, 1]);

    function setCsvData(pre) {
        data.value.push(pre);
    }

    function resetCsvData() {
        data.value = [];
    }

    return { data, setCsvData, resetCsvData, reset };
})