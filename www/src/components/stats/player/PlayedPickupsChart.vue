<template>
  <div class="content">
    <apexchart
      type="area"
      height="100%"
      width="100%"
      :options="chartOptions"
      :series="series"
    ></apexchart>
  </div>
</template>

<script lang="ts">
import VueApexCharts from "vue3-apexcharts";

import { defineComponent } from "vue";

type BarChartData = {
  name: string;
  amountServer: number;
  amountPlayer: number;
};

export default defineComponent({
  components: { apexchart: VueApexCharts },
  props: {
    amountData: {
      type: Object as () => BarChartData[],
      required: true,
    },
  },
  setup(props) {
    const series = [
      {
        name: "Player",
        data: props.amountData.map((d) => d.amountPlayer),
      },
      {
        name: "Server",
        data: props.amountData.map((d) => d.amountServer),
      },
    ];

    const chartOptions: ApexCharts.ApexOptions = {
      title: {
        text: "Played pickups",
        align: "center",
        offsetY: 40,
        style: {
          fontWeight: 400,
          fontSize: "20px",
        },
      },
      chart: {
        fontFamily: 'font-family: "Roboto", sans-serif',
        foreColor: "#fff",
        type: "area",
        height: 350,
        stacked: false,
        toolbar: {
          show: false,
        },
      },
      plotOptions: {
        area: {
          fillTo: "end",
        },
      },
      tooltip: {
        theme: "dark",
      },
      colors: ["rgb(30, 175, 237)", "rgba(206, 212, 220, 0.2)"],
      dataLabels: {
        enabled: false,
      },
      stroke: {
        curve: "smooth",
      },
      legend: {
        position: "top",
        horizontalAlign: "right",
      },
      xaxis: {
        type: "category",
      },
      yaxis: {
        title: {
          text: "Pickups",
          style: {
            fontFamily: '"Roboto", sans-serif',
            fontWeight: 300,
            fontSize: "16px",
          },
        },
      },
      labels: props.amountData.map((d) => d.name),
    };
    return {
      series,
      chartOptions,
    };
  },
});
</script>

<style lang="scss" scoped>
</style>
