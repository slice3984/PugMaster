<template>
  <apexchart
    type="donut"
    width="100%"
    :options="chartOptions"
    :series="chartOptions.series"
  ></apexchart>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import VueApexCharts from "vue3-apexcharts";

type DonutChartData = {
  name: string;
  amount: number;
};

export default defineComponent({
  components: { apexchart: VueApexCharts },
  props: {
    data: {
      type: Object as () => DonutChartData[],
      required: true,
    },
  },
  setup(props) {
    const chartOptions: ApexCharts.ApexOptions = {
      title: {
        text: "Played pickups",
        align: "center",
        offsetX: 40,
        style: {
          fontWeight: 400,
          fontSize: "20px",
        },
      },
      chart: {
        fontFamily: '"Roboto", sans-serif',
        width: 380,
        type: "donut",
        foreColor: "#fff",
        dropShadow: {
          enabled: true,
        },
      },
      labels: props.data.map((d) => d.name),
      series: props.data.map((d) => d.amount),
      legend: {
        position: "left",
        itemMargin: {
          vertical: 5,
          horizontal: 10,
        },
        offsetY: 50,
        floating: true,
      },
      plotOptions: {
        pie: {
          customScale: 1,
          offsetX: 40,
          offsetY: 20,
          donut: {
            size: "50%",
          },
        },
      },
      colors: [
        "rgba(255, 8, 54, 0.3)",
        "rgba(50, 224, 196, 0.3)",
        "rgba(129, 5, 216, 0.3)",
        "rgba(148, 252, 19, 0.3)",
        "rgba(255, 0, 139, 0.3)",
        "rgba(255, 246, 218, 0.3)",
        "rgba(255, 214, 21, 0.3)",
        "rgba(255, 93, 162, 0.3)",
        "rgba(30, 175, 237, 0.3)",
        "rgba(248, 169, 120, 0.3)",
      ],
      dataLabels: {
        style: {
          colors: ["#fff"],
        },
      },
      stroke: {
        colors: [
          "rgb(255, 8, 54)",
          "rgb(50, 224, 196)",
          "rgb(129, 5, 216)",
          "rgb(148, 252, 19)",
          "rgb(255, 0, 139)",
          "rgb(255, 246, 218)",
          "rgb(255, 214, 21)",
          "rgb(255, 93, 162)",
          "rgb(30, 175, 237)",
          "rgb(248, 169, 120)",
        ],
      },
      yaxis: {
        show: false,
      },
    };

    return {
      chartOptions,
    };
  },
});
</script>

<style lang="scss" scoped>
</style>
