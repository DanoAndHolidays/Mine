import { defineStore } from "pinia";
import { ref } from "vue";

export const useCsvStore = defineStore('csv', () => {

    const data = ref([1, 1, 1, 1, 1]);

    function setCsvData(csv) {
        data.value.push(csv);
    }

    function resetCsvData() {
        data.value = [];
    }

    return { data, setCsvData, resetCsvData };
})
