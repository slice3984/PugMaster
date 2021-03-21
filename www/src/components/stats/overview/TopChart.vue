<template>
  <div class="content">
    <div class="chart-navigation">
      <base-button
        :active="activeData === 'amount'"
        @click="handleChartUpdate('amount')"
        >Amount</base-button
      >
      <base-button
        :active="activeData === 'rating'"
        @click="handleChartUpdate('rating')"
        >Rating</base-button
      >
    </div>
    <apexchart
      type="bar"
      height="100%"
      width="100%"
      :options="chartOptions"
      :series="series"
    ></apexchart>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import VueApexCharts from "vue3-apexcharts";

type BarChartData = {
  nick: string;
  amount: number;
};

export default defineComponent({
  components: { apexchart: VueApexCharts },

  props: {
    amountData: {
      type: Object as () => BarChartData[],
      required: true,
    },
    ratingData: {
      type: Object as () => BarChartData[],
      required: true,
    },
  },
  setup(props) {
    const activeData = ref(null);

    let series = ref([
      {
        name: "",
        data: [],
      },
    ]);

    const colors = [
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
    ];

    const chartOptions = ref<ApexCharts.ApexOptions>({
      chart: {
        fontFamily: 'font-family: "Roboto", sans-serif',
        type: "bar",
        foreColor: "#fff",
        dropShadow: {
          enabled: true,
        },
        toolbar: {
          show: false,
        },
      },
      tooltip: {
        theme: "dark",
      },
      plotOptions: {
        bar: {
          borderRadius: 2,
          columnWidth: "80%",
          distributed: true,
        },
      },
      dataLabels: {
        enabled: false,
      },
      grid: {
        show: true,
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      stroke: {
        width: 2,
        colors: colors,
      },
      legend: {
        show: false,
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
    });

    const updateChart = (
      chartTitle: string,
      yAxsisTitle: string,
      labels: string[],
      amounts: number[]
    ) => {
      series.value = [
        {
          name: yAxsisTitle,
          data: amounts,
        },
      ];

      chartOptions.value = {
        ...chartOptions.value,
        title: {
          text: chartTitle,
          align: "center",
          offsetY: 0,
          style: {
            fontWeight: 400,
            fontSize: "20px",
          },
        },
        xaxis: {
          axisTicks: {
            show: false,
          },
          axisBorder: {
            show: false,
          },
          labels: {
            rotate: 0,
            style: {
              fontFamily: '"Roboto", sans-serif',
              fontWeight: 300,
            },
            trim: true,
            hideOverlappingLabels: false,
          },
          categories: labels,
        },
        yaxis: {
          // @ts-ignore
          max: Math.max(...amounts),
          title: {
            text: yAxsisTitle,
            style: {
              fontFamily: '"Roboto", sans-serif',
              fontWeight: 300,
              fontSize: "16px",
            },
          },
        },
      };
    };

    const handleChartUpdate = (toDisplay: string) => {
      if (activeData.value === toDisplay) {
        return;
      }

      switch (toDisplay) {
        case "amount":
          updateChart(
            "Top 10 Players - Amount",
            "Pickups",
            props.amountData.map((d) => d.nick),
            props.amountData.map((d) => d.amount)
          );
          break;
        case "rating":
          updateChart(
            "Top 10 Players - Rating",
            "Rating",
            props.ratingData.map((d) => d.nick),
            props.ratingData.map((d) => d.amount)
          );
      }

      activeData.value = toDisplay;
    };

    // Initial data
    handleChartUpdate("amount");

    return {
      series,
      chartOptions,
      activeData,
      handleChartUpdate,
    };
  },
});
</script>

<style lang="scss" scoped>
.content {
  position: relative;
}

.chart-navigation {
  z-index: 10;
  position: absolute;
  top: 0;
  right: 0;
}
</style>