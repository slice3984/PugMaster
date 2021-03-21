<template>
  <div class="content">
    <div class="chart-navigation">
      <base-button
        :active="activeData === 'month'"
        @click="handleChartUpdate('month')"
        >By Month</base-button
      >
      <base-button
        :active="activeData === 'weekdays'"
        @click="handleChartUpdate('weekdays')"
        >By Weekdays</base-button
      >
      <base-button
        :active="activeData === 'time'"
        @click="handleChartUpdate('time')"
        >By Time</base-button
      >
    </div>
    <apexchart
      class="content__chart"
      type="area"
      height="100%"
      ref="chart"
      :options="chartOptions"
      :series="series"
    ></apexchart>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import VueApexCharts from "vue3-apexcharts";

export default defineComponent({
  components: { apexchart: VueApexCharts },
  props: {
    timestamps: {
      type: Object as () => string[],
      required: true,
    },
  },
  setup(props) {
    const activeData = ref(null);

    const series = ref([
      {
        name: "",
        data: [],
      },
    ]);
    const chartOptions = ref<ApexCharts.ApexOptions>({
      chart: {
        id: "activity-chart",
        type: "area",
        offsetY: 10,
        foreColor: "#fff",
        toolbar: {
          show: false,
        },
        zoom: {
          enabled: false,
        },
        redrawOnWindowResize: true,
      },
      grid: {
        show: true,
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      dataLabels: {
        enabled: false,
      },
      markers: {
        size: 0,
      },
      xaxis: {
        type: "category",
      },
      tooltip: {
        theme: "dark",
      },
      fill: {
        type: "gradient",
        gradient: {
          shade: "dark",
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.9,
          stops: [0, 100],
        },
      },
    });

    const updateChart = (
      chartTitle: string,
      yAxisTitle: string,
      data: { label: string; amount: Number }[]
    ) => {
      series.value = [
        {
          name: yAxisTitle,
          data: data.map((pair) => pair.amount),
        },
      ];

      chartOptions.value = {
        ...chartOptions.value,
        labels: data.map((pair) => pair.label),
        title: {
          text: chartTitle,
          align: "center",
          style: {
            fontWeight: 400,
            fontSize: "20px",
          },
        },
        yaxis: {
          title: {
            text: yAxisTitle,
            style: {
              fontFamily: '"Roboto", sans-serif',
              fontWeight: 300,
              fontSize: "16px",
            },
          },
        },
      };
    };

    const formatData = (
      dates: string[],
      groupBy: "days" | "weekdays" | "time"
    ): { label: string; amount: Number }[] => {
      const weekdays = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      const times = [
        "12am",
        "1am",
        "2am",
        "3am",
        "4am",
        "5am",
        "6am",
        "7am",
        "8am",
        "9am",
        "10am",
        "11am",
        "12pm",
        "1pm",
        "2pm",
        "3pm",
        "4pm",
        "5pm",
        "6pm",
        "7pm",
        "8pm",
        "9pm",
        "10pm",
        "11pm",
      ];

      const localizedDates = dates.map((d) => new Date(d));
      const generateResults = (dateStrings: string[]) => {
        const amounts: Map<string, number> = new Map();

        for (const date of dateStrings) {
          const entry = amounts.get(date);

          if (entry) {
            amounts.set(date, entry + 1);
          } else {
            amounts.set(date, 1);
          }
        }

        const results = [];
        for (const [date, amount] of amounts) {
          results.push({
            label: date,
            amount,
          });
        }

        if (groupBy === "weekdays") {
          weekdays.forEach((day) => {
            if (!dateStrings.includes(day)) {
              results.push({
                label: day,
                amount: 0,
              });
            }
          });

          results.sort((r, r2) => {
            return (
              weekdays.findIndex((day) => day === r.label) -
              weekdays.findIndex((day) => day === r2.label)
            );
          });
        }

        if (groupBy === "time") {
          times.forEach((time) => {
            if (!dateStrings.includes(time)) {
              results.push({
                label: time,
                amount: 0,
              });
            }
          });

          results.sort((r, r2) => {
            return (
              times.findIndex((time) => time === r.label) -
              times.findIndex((time) => time === r2.label)
            );
          });
        }

        return results;
      };

      switch (groupBy) {
        case "days":
          const dateStrings = localizedDates.map((d) =>
            d.toLocaleDateString(undefined, {
              month: "2-digit",
              day: "numeric",
            })
          );

          return generateResults(dateStrings);
        case "weekdays":
          const weekdayStrings = localizedDates.map((d) => {
            return weekdays[d.getDay()];
          });

          return generateResults(weekdayStrings);
        case "time":
          const timeStrings = localizedDates.map((d) =>
            d
              .toLocaleTimeString(undefined, {
                hour: "numeric",
                hour12: true,
              })
              .toLowerCase()
              .replace(" ", "")
          );

          return generateResults(timeStrings);
      }
    };

    const handleChartUpdate = (toDisplay: string) => {
      if (activeData.value === toDisplay) {
        return;
      }

      switch (toDisplay) {
        case "month":
          updateChart(
            "Pickup activity - month (Last 30 days)",
            "Pickups",
            formatData(props.timestamps, "days")
          );
          break;
        case "weekdays":
          updateChart(
            "Pickup activity - weekdays (Last 30 days)",
            "Pickups",
            formatData(props.timestamps, "weekdays")
          );
          break;
        case "time":
          updateChart(
            "Pickup activity - time (Last 30 days)",
            "Pickups",
            formatData(props.timestamps, "time")
          );
      }

      activeData.value = toDisplay;
    };

    // Initial data
    handleChartUpdate("month");

    return {
      chartOptions,
      series,
      activeData,
      handleChartUpdate,
    };
  },
});
</script>

<style lang="scss" scoped>
.content {
  position: relative;
  height: 90%;

  &__chart {
    margin-top: 4rem;
    height: 100%;
    width: 100%;
  }
}

.chart-navigation {
  z-index: 10;
  position: absolute;
  top: 0;
  right: 0;
}
</style>