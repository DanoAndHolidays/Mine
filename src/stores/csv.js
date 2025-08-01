import { defineStore } from "pinia";
import { ref } from "vue";

export const useCsvStore = defineStore('csv', () => {

    const data = ref([]);

    function setCsvData(csv) {
        data.value.push(csv);
    }

    function resetCsvData() {
        data.value = [];
    }

    return { data, setCsvData, resetCsvData };
})
